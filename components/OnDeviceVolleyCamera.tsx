import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
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
  onInferenceStatus?: (status: { ready: boolean; confidence: number; error?: string }) => void;
};

const INPUT_WIDTH = 96;
const INPUT_HEIGHT = 96;
const GRID_COLUMNS = 16;
const GRID_ROWS = 12;
const GRID_CELL_COUNT = GRID_COLUMNS * GRID_ROWS;
const FOOT_START_ROW = 7;
const MIN_LOCAL_FOOT_MOTION = 4.2;

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

function detectFootCandidate(input: Uint8Array, previousCells: number[], previousCandidate: FootCandidate) {
  "worklet";
  let bestScore = 0;
  let bestX = 0.5;
  let bestY = 0.78;
  let bestMotion = 0;
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
      const bottomBias = 0.75 + Math.pow(row / (GRID_ROWS - 1), 2) * 1.35;
      const sidePenalty = 1 - Math.abs(normalizedX - 0.5) * 0.08;
      const continuity = previousCandidate.confidence > 0
        ? Math.max(0.5, 1 - Math.hypot(normalizedX - previousCandidate.x, normalizedY - previousCandidate.y) * 1.15)
        : 0.78;
      const localProminence = averageLowerMotion > 0 ? motion / averageLowerMotion : 0;
      const prominenceScore = Math.min(80, Math.max(0, localProminence - 0.85) * 38);
      const motionScore = Math.min(100, Math.max(0, motion - 2.4) * 8.2);
      const appearanceScore = (cellDarkness[cellIndex] ?? 0) * 0.22 + (cellContrast[cellIndex] ?? 0) * 0.18;
      const rowGate = normalizedY >= 0.58 ? 1 : 0.35;
      const motionGate = motion >= MIN_LOCAL_FOOT_MOTION ? 1 : 0.18;
      const score =
        (motionScore * 0.58 + prominenceScore * 0.27 + appearanceScore * 0.15) *
        bottomBias *
        sidePenalty *
        continuity *
        rowGate *
        motionGate;

      if (score > bestScore) {
        bestScore = score;
        bestX = normalizedX;
        bestY = normalizedY;
        bestMotion = motion;
      }
    }
  }

  if ((bestScore <= 0 || bestMotion < MIN_LOCAL_FOOT_MOTION) && previousCandidate.confidence > 0.08) {
    return {
      candidate: {
        x: previousCandidate.x,
        y: previousCandidate.y,
        confidence: previousCandidate.confidence * 0.58,
      },
      cells: nextCells,
    };
  }

  const rawConfidence = bestMotion < MIN_LOCAL_FOOT_MOTION ? bestScore / 280 : bestScore / 120;
  return {
    candidate: {
      x: clamp01(bestX),
      y: clamp01(bestY),
      confidence: clamp01(rawConfidence),
    },
    cells: nextCells,
  };
}

export function OnDeviceVolleyCamera({
  width,
  height,
  showStatusBadge = false,
  onFootDetected,
  onInferenceStatus,
}: OnDeviceVolleyCameraProps) {
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const { resize } = useResizePlugin();
  const previousCells = useSharedValue<number[]>(Array(GRID_CELL_COUNT).fill(0));
  const previousCandidate = useSharedValue<FootCandidate>({ x: 0.5, y: 0.78, confidence: 0 });
  const reportFoot = useRunOnJS((x: number, y: number, confidence: number) => {
    onFootDetected?.({ x, y, confidence });
  }, [onFootDetected]);
  const reportStatus = useRunOnJS((ready: boolean, confidence: number, error?: string) => {
    onInferenceStatus?.({ ready, confidence, error });
  }, [onInferenceStatus]);

  useEffect(() => {
    onInferenceStatus?.({ ready: true, confidence: 0 });
  }, [onInferenceStatus]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const privacy = useMemo(() => assertNoNetworkFrameTransport(), []);

  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";
    runAtTargetFps(15, () => {
      "worklet";
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

      const detection = detectFootCandidate(input, previousCells.value, previousCandidate.value);
      previousCells.value = detection.cells;

      const last = previousCandidate.value;
      const alpha = detection.candidate.confidence > 0.32 ? 0.54 : 0.34;
      const candidate = {
        x: clamp01(last.x + (detection.candidate.x - last.x) * alpha),
        y: clamp01(last.y + (detection.candidate.y - last.y) * alpha),
        confidence: clamp01(last.confidence * 0.4 + detection.candidate.confidence * 0.6),
      };
      previousCandidate.value = candidate;

      reportStatus(true, candidate.confidence);
      if (candidate.confidence < 0.18) return;
      reportFoot(candidate.x * width, candidate.y * height, candidate.confidence);
    });
  }, [previousCandidate, previousCells, reportFoot, reportStatus, resize, width, height]);

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
          <Text style={styles.badgeSubText}>motion foot tracker / no TFLite runtime</Text>
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
