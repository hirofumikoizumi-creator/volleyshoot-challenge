import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NitroModules } from "react-native-nitro-modules";
import { Camera, runAtTargetFps, useCameraDevice, useCameraPermission, useFrameProcessor } from "react-native-vision-camera";
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
  onInferenceStatus?: (status: { ready: boolean; confidence: number; error?: string }) => void;
};

const MODEL_INPUT_SIZE = 256;
const LANDMARK_STRIDE = 5;
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;
const LEFT_HEEL = 29;
const RIGHT_HEEL = 30;
const LEFT_FOOT_INDEX = 31;
const RIGHT_FOOT_INDEX = 32;

type ModelTensorDataType =
  | "string"
  | "float16"
  | "float32"
  | "float64"
  | "bfloat16"
  | "int4"
  | "int8"
  | "int16"
  | "int32"
  | "int64"
  | "uint8"
  | "uint16"
  | "uint32"
  | "uint64"
  | "bool"
  | "complex64"
  | "complex128"
  | "resource"
  | "variant"
  | "none";

function tensorDataTypeBytes(dataType: ModelTensorDataType) {
  switch (dataType) {
    case "float16":
    case "bfloat16":
    case "int16":
    case "uint16":
      return 2;
    case "float32":
    case "int32":
    case "uint32":
      return 4;
    case "float64":
    case "int64":
    case "uint64":
      return 8;
    case "int4":
      return 0.5;
    case "int8":
    case "uint8":
    case "bool":
      return 1;
    default:
      return 0;
  }
}

function tensorElementCount(shape: number[]) {
  return shape.reduce((total, value) => total * Math.max(1, Math.round(value)), 1);
}

function inferSquareInputSize(shape: number[]) {
  const imageDimensions = shape.map((value) => Math.round(value)).filter((value) => value >= 32);
  if (imageDimensions.length < 2) return MODEL_INPUT_SIZE;
  return Math.min(imageDimensions[0] ?? MODEL_INPUT_SIZE, imageDimensions[1] ?? MODEL_INPUT_SIZE);
}

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
  onInferenceStatus,
}: OnDeviceVolleyCameraProps) {
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const [modelError, setModelError] = useState<string | null>(null);
  const { debugOverlayEnabled, inferenceFps, setModelReady } = usePosePipelineStore();
  const modelState = useTensorflowModel(modelAsset ?? 0, []);
  const model = modelState.state === "loaded" ? modelState.model : undefined;
  const boxedModel = useMemo(() => (model ? NitroModules.box(model) : undefined), [model]);
  const inputMetadata = useMemo(() => {
    const inputTensor = model?.inputs[0];
    if (!inputTensor) {
      return {
        expectedBytes: 0,
        inputSize: MODEL_INPUT_SIZE,
        resizeDataType: "uint8" as const,
        label: "input: unknown",
      };
    }

    const bytesPerValue = tensorDataTypeBytes(inputTensor.dataType);
    const expectedBytes = Math.round(tensorElementCount(inputTensor.shape) * bytesPerValue);
    const resizeDataType: "float32" | "uint8" = inputTensor.dataType === "float32" ? "float32" : "uint8";

    return {
      expectedBytes,
      inputSize: inferSquareInputSize(inputTensor.shape),
      resizeDataType,
      label: `${inputTensor.dataType} ${inputTensor.shape.join("x")} / ${expectedBytes}b`,
    };
  }, [model]);
  const landmarkOutputIndex = useMemo(() => {
    const outputs = model?.outputs ?? [];
    const exactIndex = outputs.findIndex(
      (output) => output.dataType === "float32" && tensorElementCount(output.shape) === 33 * LANDMARK_STRIDE,
    );
    if (exactIndex >= 0) return exactIndex;

    return outputs.findIndex(
      (output) => output.dataType === "float32" && tensorElementCount(output.shape) >= 33 * LANDMARK_STRIDE,
    );
  }, [model]);
  const { resize } = useResizePlugin();
  const reportFoot = useRunOnJS((x: number, y: number, confidence: number) => {
    onFootDetected?.({ x, y, confidence });
  }, [onFootDetected]);
  const reportStatus = useRunOnJS((ready: boolean, confidence: number, error?: string) => {
    onInferenceStatus?.({ ready, confidence, error });
  }, [onInferenceStatus]);

  useEffect(() => {
    setModelError(null);

    if (!modelAsset) {
      setModelError("BlazePose Lite model asset is not configured yet.");
      setModelReady(false);
      onInferenceStatus?.({ ready: false, confidence: 0, error: "model-missing" });
      return;
    }

    if (modelState.state === "loaded") {
      setModelReady(true);
      onInferenceStatus?.({ ready: true, confidence: 0 });
      return;
    }

    if (modelState.state === "error") {
      setModelError(modelState.error.message);
      setModelReady(false);
      onInferenceStatus?.({ ready: false, confidence: 0, error: modelState.error.message });
      return;
    }

    setModelReady(false);
  }, [modelAsset, modelState, onInferenceStatus, setModelReady]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const privacy = useMemo(() => assertNoNetworkFrameTransport(), []);

  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";
    if (boxedModel == null) return;

    runAtTargetFps(15, () => {
      "worklet";
      const tflite = boxedModel.unbox();
      const input = resize(frame, {
        scale: { width: inputMetadata.inputSize, height: inputMetadata.inputSize },
        mirror: true,
        pixelFormat: "rgb",
        dataType: inputMetadata.resizeDataType,
      });

      if (inputMetadata.expectedBytes <= 0) {
        reportStatus(true, 0, "input-metadata-missing");
        return;
      }

      if (input.byteLength !== inputMetadata.expectedBytes) {
        reportStatus(true, 0, `input-size-${input.byteLength}-expected-${inputMetadata.expectedBytes}`);
        return;
      }

      const inputBuffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;

      let outputs: ArrayBuffer[] = [];
      try {
        outputs = tflite.runSync([inputBuffer]);
      } catch (error) {
        reportStatus(true, 0, "tflite-run-failed");
        return;
      }

      const landmarkBuffer =
        landmarkOutputIndex >= 0 && landmarkOutputIndex < outputs.length
          ? outputs[landmarkOutputIndex]
          : outputs.find((output) => output.byteLength >= 33 * LANDMARK_STRIDE * 4 && output.byteLength % 4 === 0);
      if (landmarkBuffer == null) {
        reportStatus(true, 0, "landmarks-missing");
        return;
      }

      if (landmarkBuffer.byteLength % 4 !== 0) {
        reportStatus(true, 0, "landmarks-not-float32");
        return;
      }

      const landmarks = new Float32Array(landmarkBuffer);
      if (landmarks.length < 33 * LANDMARK_STRIDE) {
        reportStatus(true, 0, "landmarks-short");
        return;
      }
      const leftFoot = contactFromSide(landmarks, LEFT_ANKLE, LEFT_HEEL, LEFT_FOOT_INDEX);
      const rightFoot = contactFromSide(landmarks, RIGHT_ANKLE, RIGHT_HEEL, RIGHT_FOOT_INDEX);
      const bestFoot =
        (leftFoot?.confidence ?? 0) >= (rightFoot?.confidence ?? 0) ? leftFoot : rightFoot;

      const confidence = bestFoot?.confidence ?? 0;
      reportStatus(true, confidence);
      if (!bestFoot || confidence < 0.6) return;
      reportFoot(bestFoot.x * width, bestFoot.y * height, confidence);
    });
  }, [boxedModel, inputMetadata, landmarkOutputIndex, reportFoot, reportStatus, resize, width, height]);

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
          {model && <Text style={styles.badgeSubText}>{inputMetadata.label}</Text>}
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
