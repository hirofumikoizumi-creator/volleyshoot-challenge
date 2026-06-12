import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from "react-native-vision-camera";
import { useTensorflowModel } from "react-native-fast-tflite";
import { useRunOnJS } from "react-native-worklets-core";
import { useResizePlugin } from "vision-camera-resize-plugin";
import type { PoseFrame } from "@/lib/pose/blazepose-types";
import { assertNoNetworkFrameTransport } from "@/lib/pose/on-device-pipeline";
import { usePosePipelineStore } from "@/lib/pose/pose-store";
import { FootDebugOverlay } from "./FootDebugOverlay";

type OnDeviceVolleyCameraProps = {
  width: number;
  height: number;
  modelAsset?: number;
  latestPose?: PoseFrame;
  showStatusBadge?: boolean;
  onFootDetected?: (point: { x: number; y: number; confidence: number }) => void;
};

const MODEL_INPUT_SIZE = 256;
const LANDMARK_STRIDE = 5;
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;
const LEFT_HEEL = 29;
const RIGHT_HEEL = 30;
const LEFT_FOOT_INDEX = 31;
const RIGHT_FOOT_INDEX = 32;

function normalizedLandmarkValue(value: number) {
  "worklet";
  if (!Number.isFinite(value)) return 0;
  if (value > 2 || value < -1) return value / MODEL_INPUT_SIZE;
  return value;
}

function readLandmark(values: Float32Array, index: number) {
  "worklet";
  const offset = index * LANDMARK_STRIDE;
  if (offset + 3 >= values.length) return undefined;
  return {
    x: normalizedLandmarkValue(values[offset] ?? 0),
    y: normalizedLandmarkValue(values[offset + 1] ?? 0),
    visibility: Math.max(0, Math.min(1, values[offset + 3] ?? values[offset + 4] ?? 0)),
  };
}

function contactFromSide(values: Float32Array, ankleIndex: number, heelIndex: number, footIndex: number) {
  "worklet";
  const ankle = readLandmark(values, ankleIndex);
  const heel = readLandmark(values, heelIndex);
  const toe = readLandmark(values, footIndex);
  if (!ankle || !heel || !toe) return undefined;
  const confidence = Math.min(ankle.visibility, heel.visibility, toe.visibility);
  return {
    x: ankle.x * 0.35 + toe.x * 0.65,
    y: ankle.y * 0.35 + toe.y * 0.65,
    confidence,
  };
}

export function OnDeviceVolleyCamera({
  width,
  height,
  modelAsset,
  latestPose,
  showStatusBadge = false,
  onFootDetected,
}: OnDeviceVolleyCameraProps) {
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const [modelError, setModelError] = useState<string | null>(null);
  const { debugOverlayEnabled, inferenceFps, setModelReady } = usePosePipelineStore();
  const modelState = useTensorflowModel(modelAsset ?? 0, []);
  const model = modelState.state === "loaded" ? modelState.model : undefined;
  const { resize } = useResizePlugin();
  const reportFoot = useRunOnJS((x: number, y: number, confidence: number) => {
    onFootDetected?.({ x, y, confidence });
  }, [onFootDetected]);

  useEffect(() => {
    setModelError(null);

    if (!modelAsset) {
      setModelError("BlazePose Lite model asset is not configured yet.");
      setModelReady(false);
      return;
    }

    if (modelState.state === "loaded") {
      setModelReady(true);
      return;
    }

    if (modelState.state === "error") {
      setModelError(modelState.error.message);
      setModelReady(false);
      return;
    }

    setModelReady(false);
  }, [modelAsset, modelState, setModelReady]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const privacy = useMemo(() => assertNoNetworkFrameTransport(), []);

  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";
    if (model == null) return;

    const input = resize(frame, {
      scale: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE },
      mirror: true,
      pixelFormat: "rgb",
      dataType: "float32",
    });

    const outputs = model.runSync([input.buffer as ArrayBuffer]);
    const landmarkBuffer = outputs.find((output) => output.byteLength >= 33 * LANDMARK_STRIDE * 4);
    if (landmarkBuffer == null) return;

    const landmarks = new Float32Array(landmarkBuffer);
    const leftFoot = contactFromSide(landmarks, LEFT_ANKLE, LEFT_HEEL, LEFT_FOOT_INDEX);
    const rightFoot = contactFromSide(landmarks, RIGHT_ANKLE, RIGHT_HEEL, RIGHT_FOOT_INDEX);
    const bestFoot =
      (leftFoot?.confidence ?? 0) >= (rightFoot?.confidence ?? 0) ? leftFoot : rightFoot;

    if (!bestFoot || bestFoot.confidence < 0.6) return;
    reportFoot(bestFoot.x * width, bestFoot.y * height, bestFoot.confidence);
  }, [model, reportFoot, resize, width, height]);

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
      {debugOverlayEnabled && <FootDebugOverlay width={width} height={height} pose={latestPose} />}
      {showStatusBadge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ON-DEVICE AI</Text>
          <Text style={styles.badgeSubText}>
            {model ? `BlazePose Lite / ${Math.round(inferenceFps)}fps` : modelError ?? "Loading model"}
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
