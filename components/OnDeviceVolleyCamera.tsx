import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Camera, runAtTargetFps, useCameraDevice, useCameraPermission, useFrameProcessor } from "react-native-vision-camera";
import { useRunOnJS } from "react-native-worklets-core";
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
const GRID_COLUMNS = 12;
const GRID_ROWS = 10;

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

function detectFootCandidate(input: Uint8Array) {
  "worklet";
  let bestScore = 0;
  let bestX = 0.5;
  let bestY = 0.78;
  const cellWidth = Math.floor(INPUT_WIDTH / GRID_COLUMNS);
  const cellHeight = Math.floor(INPUT_HEIGHT / GRID_ROWS);

  for (let row = 3; row < GRID_ROWS; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      let darkness = 0;
      let contrast = 0;
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
          darkness += Math.max(0, 160 - center);
          contrast += Math.abs(center - right) + Math.abs(center - down);
          samples += 1;
        }
      }

      if (samples <= 0) continue;
      const lowerBias = 0.65 + row / GRID_ROWS;
      const centerBias = 1 - Math.abs(column / (GRID_COLUMNS - 1) - 0.5) * 0.35;
      const score = ((darkness / samples) * 0.68 + (contrast / samples) * 0.32) * lowerBias * centerBias;

      if (score > bestScore) {
        bestScore = score;
        bestX = (startX + endX) / 2 / INPUT_WIDTH;
        bestY = (startY + endY) / 2 / INPUT_HEIGHT;
      }
    }
  }

  return {
    x: clamp01(bestX),
    y: clamp01(bestY),
    confidence: clamp01(bestScore / 130),
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

      const candidate = detectFootCandidate(input);
      reportStatus(true, candidate.confidence);
      if (candidate.confidence < 0.12) return;
      reportFoot(candidate.x * width, candidate.y * height, candidate.confidence);
    });
  }, [reportFoot, reportStatus, resize, width, height]);

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
          <Text style={styles.badgeSubText}>safe pixel tracker / no TFLite runtime</Text>
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
