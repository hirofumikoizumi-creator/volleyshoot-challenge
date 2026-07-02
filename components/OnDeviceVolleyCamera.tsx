import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTensorflowModel } from "react-native-fast-tflite";
import { Camera, runAtTargetFps, useCameraDevice, useCameraPermission, useFrameProcessor } from "react-native-vision-camera";
import { useRunOnJS, useSharedValue } from "react-native-worklets-core";
import { useResizePlugin } from "vision-camera-resize-plugin";
import { assertNoNetworkFrameTransport } from "@/lib/pose/on-device-pipeline";

type OnDeviceVolleyCameraProps = {
  width: number;
  height: number;
  modelAsset?: number;
  showStatusBadge?: boolean;
  onFootDetected?: (point: { x: number; y: number; confidence: number }) => void;
  onFeetDetected?: (feet: {
    left?: { x: number; y: number; confidence: number };
    right?: { x: number; y: number; confidence: number };
  }) => void;
  onInferenceStatus?: (status: { ready: boolean; confidence: number; error?: string }) => void;
};

const INPUT_WIDTH = 96;
const INPUT_HEIGHT = 96;
const MOVENET_INPUT_WIDTH = 192;
const MOVENET_INPUT_HEIGHT = 192;
const GRID_COLUMNS = 16;
const GRID_ROWS = 12;
const GRID_CELL_COUNT = GRID_COLUMNS * GRID_ROWS;
const FOOT_START_ROW = 5;
const MIN_LOCAL_FOOT_MOTION = 2.1;
const FOOT_REPORT_THRESHOLD = 0.1;

function clamp01(value: number) {
  "worklet";
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function sampleBrightness(input: Uint8Array, x: number, y: number) {
  "worklet";
  const safeX = Math.max(0, Math.min(INPUT_WIDTH - 1, x));
  const safeY = Math.max(0, Math.min(INPUT_HEIGHT - 1, y));
  const offset = (safeY * INPUT_WIDTH + safeX) * 3;
  const r = input[offset] ?? 0;
  const g = input[offset + 1] ?? 0;
  const b = input[offset + 2] ?? 0;
  return (r + g + b) / 3;
}

type FootCandidate = {
  x: number;
  y: number;
  confidence: number;
};

function emptyCandidate(x: number) {
  "worklet";
  return { x, y: 0.78, confidence: 0 };
}

function detectFootCandidates(
  input: Uint8Array,
  previousCells: number[],
) {
  "worklet";
  let leftWeight = 0;
  let rightWeight = 0;
  let leftX = 0;
  let leftY = 0;
  let rightX = 0;
  let rightY = 0;
  let lowerMotionTotal = 0;
  let lowerMotionCells = 0;
  const nextCells = new Array(GRID_CELL_COUNT).fill(0);
  const cellBrightness = new Array(GRID_CELL_COUNT).fill(0);
  const cellMotion = new Array(GRID_CELL_COUNT).fill(0);
  const cellDarkness = new Array(GRID_CELL_COUNT).fill(0);
  const cellContrast = new Array(GRID_CELL_COUNT).fill(0);
  const cellWidth = Math.floor(INPUT_WIDTH / GRID_COLUMNS);
  const cellHeight = Math.floor(INPUT_HEIGHT / GRID_ROWS);

  for (let row = FOOT_START_ROW; row < GRID_ROWS; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      let darkness = 0;
      let contrast = 0;
      let brightness = 0;
      let samples = 0;
      const startX = column * cellWidth;
      const startY = row * cellHeight;
      const endX = Math.min(INPUT_WIDTH - 1, startX + cellWidth);
      const endY = Math.min(INPUT_HEIGHT - 1, startY + cellHeight);

      for (let y = startY; y < endY; y += 3) {
        for (let x = startX; x < endX; x += 3) {
          const center = sampleBrightness(input, x, y);
          const right = sampleBrightness(input, x + 2, y);
          const down = sampleBrightness(input, x, y + 2);
          brightness += center;
          darkness += Math.max(0, 160 - center);
          contrast += Math.abs(center - right) + Math.abs(center - down);
          samples += 1;
        }
      }

      if (samples <= 0) continue;
      const cellIndex = row * GRID_COLUMNS + column;
      const averageBrightness = brightness / samples;
      const previousBrightness = previousCells[cellIndex] ?? averageBrightness;
      const motion = Math.abs(averageBrightness - previousBrightness);
      nextCells[cellIndex] = averageBrightness;
      cellBrightness[cellIndex] = averageBrightness;
      cellMotion[cellIndex] = motion;
      cellDarkness[cellIndex] = darkness / samples;
      cellContrast[cellIndex] = contrast / samples;
      lowerMotionTotal += motion;
      lowerMotionCells += 1;
    }
  }

  const averageLowerMotion = lowerMotionCells > 0 ? lowerMotionTotal / lowerMotionCells : 0;

  for (let row = FOOT_START_ROW; row < GRID_ROWS; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      const startX = column * cellWidth;
      const startY = row * cellHeight;
      const endX = Math.min(INPUT_WIDTH - 1, startX + cellWidth);
      const endY = Math.min(INPUT_HEIGHT - 1, startY + cellHeight);
      const cellIndex = row * GRID_COLUMNS + column;
      const motion = cellMotion[cellIndex] ?? 0;

      const normalizedX = (startX + endX) / 2 / INPUT_WIDTH;
      const normalizedY = (startY + endY) / 2 / INPUT_HEIGHT;
      const isLeftSide = normalizedX < 0.5;
      const bottomBias = 0.75 + Math.pow(row / (GRID_ROWS - 1), 2) * 1.35;
      const sidePenalty = 1 - Math.abs(normalizedX - 0.5) * 0.08;
      const localProminence = averageLowerMotion > 0 ? motion / averageLowerMotion : 0;
      const prominenceScore = Math.min(80, Math.max(0, localProminence - 0.72) * 42);
      const motionScore = Math.min(100, Math.max(0, motion - 1.3) * 9.4);
      const appearanceScore = (cellDarkness[cellIndex] ?? 0) * 0.18 + (cellContrast[cellIndex] ?? 0) * 0.16;
      const rowGate = normalizedY >= 0.5 ? 1 : 0.48;
      const motionGate = motion >= MIN_LOCAL_FOOT_MOTION ? 1 : 0.42;
      const score =
        (motionScore * 0.58 + prominenceScore * 0.27 + appearanceScore * 0.15) *
        bottomBias *
        sidePenalty *
        rowGate *
        motionGate;

      if (isLeftSide) {
        leftWeight += score;
        leftX += normalizedX * score;
        leftY += normalizedY * score;
      } else {
        rightWeight += score;
        rightX += normalizedX * score;
        rightY += normalizedY * score;
      }
    }
  }

  const left = leftWeight > 0
    ? { x: clamp01(leftX / leftWeight), y: clamp01(leftY / leftWeight), confidence: clamp01(leftWeight / 1200) }
    : emptyCandidate(0.36);
  const right = rightWeight > 0
    ? { x: clamp01(rightX / rightWeight), y: clamp01(rightY / rightWeight), confidence: clamp01(rightWeight / 1200) }
    : emptyCandidate(0.64);

  return {
    left,
    right,
    cells: nextCells,
  };
}

export function OnDeviceVolleyCamera({
  width,
  height,
  modelAsset,
  showStatusBadge = false,
  onFootDetected,
  onFeetDetected,
  onInferenceStatus,
}: OnDeviceVolleyCameraProps) {
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const { resize } = useResizePlugin();
  const modelState = useTensorflowModel(modelAsset ?? 0, []);
  const tfliteModel = modelState.state === "loaded" ? modelState.model : undefined;
  const previousCells = useSharedValue<number[]>(Array(GRID_CELL_COUNT).fill(0));
  const reportFoot = useRunOnJS((x: number, y: number, confidence: number) => {
    onFootDetected?.({ x, y, confidence });
  }, [onFootDetected]);
  const reportFeet = useRunOnJS(
    (
      leftX: number,
      leftY: number,
      leftConfidence: number,
      rightX: number,
      rightY: number,
      rightConfidence: number,
    ) => {
      onFeetDetected?.({
        left: { x: leftX, y: leftY, confidence: leftConfidence },
        right: { x: rightX, y: rightY, confidence: rightConfidence },
      });
    },
    [onFeetDetected],
  );
  const hasFeetReporter = useSharedValue(Boolean(onFeetDetected));
  const reportStatus = useRunOnJS((ready: boolean, confidence: number, error?: string) => {
    onInferenceStatus?.({ ready, confidence, error });
  }, [onInferenceStatus]);

  useEffect(() => {
    if (!modelAsset) {
      onInferenceStatus?.({ ready: true, confidence: 0, error: "movenet-model-missing-fallback-active" });
      return;
    }
    if (modelState.state === "loaded") {
      onInferenceStatus?.({ ready: true, confidence: 0 });
      return;
    }
    if (modelState.state === "error") {
      onInferenceStatus?.({ ready: true, confidence: 0, error: modelState.error.message });
      return;
    }
    onInferenceStatus?.({ ready: false, confidence: 0 });
  }, [modelAsset, modelState, onInferenceStatus]);

  useEffect(() => {
    hasFeetReporter.value = Boolean(onFeetDetected);
  }, [hasFeetReporter, onFeetDetected]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const privacy = useMemo(() => assertNoNetworkFrameTransport(), []);

  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";
    runAtTargetFps(24, () => {
      "worklet";
      if (tfliteModel != null) {
        const movenetInput = resize(frame, {
          scale: { width: MOVENET_INPUT_WIDTH, height: MOVENET_INPUT_HEIGHT },
          mirror: true,
          pixelFormat: "rgb",
          dataType: "uint8",
        });

        try {
          const outputs = tfliteModel.runSync([movenetInput]);
          const keypoints = outputs?.[0] as ArrayLike<number> | undefined;
          if (keypoints != null && keypoints.length >= 51) {
            const leftIndex = 15 * 3;
            const rightIndex = 16 * 3;
            const leftY = Number(keypoints[leftIndex]);
            const leftX = Number(keypoints[leftIndex + 1]);
            const leftScore = Number(keypoints[leftIndex + 2]);
            const rightY = Number(keypoints[rightIndex]);
            const rightX = Number(keypoints[rightIndex + 1]);
            const rightScore = Number(keypoints[rightIndex + 2]);
            const confidence = Math.max(leftScore, rightScore);
            reportStatus(true, confidence);
            reportFeet(
              clamp01(leftX) * width,
              clamp01(leftY) * height,
              clamp01(leftScore),
              clamp01(rightX) * width,
              clamp01(rightY) * height,
              clamp01(rightScore),
            );
            if (!hasFeetReporter.value && confidence >= FOOT_REPORT_THRESHOLD) {
              if (leftScore >= rightScore) reportFoot(clamp01(leftX) * width, clamp01(leftY) * height, clamp01(leftScore));
              else reportFoot(clamp01(rightX) * width, clamp01(rightY) * height, clamp01(rightScore));
            }
            return;
          }
        } catch (error) {
          reportStatus(true, 0, "movenet-run-failed-fallback-active");
        }
      }

      const input = resize(frame, {
        scale: { width: INPUT_WIDTH, height: INPUT_HEIGHT },
        mirror: true,
        pixelFormat: "rgb",
        dataType: "uint8",
      });

      if (input.byteLength !== INPUT_WIDTH * INPUT_HEIGHT * 3) {
        reportStatus(true, 0, `safe-foot-input-size-${input.byteLength}`);
        return;
      }

      const detection = detectFootCandidates(input, previousCells.value);
      previousCells.value = detection.cells;

      const left = detection.left;
      const right = detection.right;

      const best = left.confidence >= right.confidence ? left : right;
      const confidence = Math.max(left.confidence, right.confidence);
      reportStatus(true, confidence);
      reportFeet(left.x * width, left.y * height, left.confidence, right.x * width, right.y * height, right.confidence);
      if (hasFeetReporter.value || confidence < FOOT_REPORT_THRESHOLD) return;
      reportFoot(best.x * width, best.y * height, best.confidence);
    });
  }, [hasFeetReporter, previousCells, reportFeet, reportFoot, reportStatus, resize, tfliteModel, width, height]);

  if (!hasPermission) {
    return (
      <View style={[styles.fallback, { width, height }]}>
        <Text style={styles.fallbackTitle}>カメラ許可を確認中</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[styles.fallback, { width, height }]}>
        <Text style={styles.fallbackTitle}>フロントカメラが見つかりません</Text>
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        resizeMode="cover"
        frameProcessor={frameProcessor}
      />
      {showStatusBadge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ON-DEVICE FOOT</Text>
          <Text style={styles.badgeSubText}>
            {modelState.state === "loaded" ? "MoveNet ankle tracking" : "motion fallback"}
          </Text>
          <Text style={styles.badgeSubText}>
            frames off-device: {privacy.cameraFramesLeaveDevice ? "yes" : "no"}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#030811",
  },
  fallbackTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(3,8,17,0.62)",
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.35)",
  },
  badgeText: {
    color: "#A3FF12",
    fontSize: 10,
    fontWeight: "900",
  },
  badgeSubText: {
    color: "#DCE7F3",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 2,
  },
});
