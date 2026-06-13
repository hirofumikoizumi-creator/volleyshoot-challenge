import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NitroModules } from "react-native-nitro-modules";
import { Camera, runAtTargetFps, useCameraDevice, useCameraPermission, useFrameProcessor } from "react-native-vision-camera";
import { useTensorflowModel } from "react-native-fast-tflite";
import { useRunOnJS } from "react-native-worklets-core";
import { useResizePlugin } from "vision-camera-resize-plugin";
import { assertNoNetworkFrameTransport } from "@/lib/pose/on-device-pipeline";
import { usePosePipelineStore } from "@/lib/pose/pose-store";

type OnDeviceVolleyCameraProps = {
  width: number;
  height: number;
  modelAsset?: number;
  showStatusBadge?: boolean;
  onFootDetected?: (point: { x: number; y: number; confidence: number }) => void;
  onInferenceStatus?: (status: { ready: boolean; confidence: number; error?: string }) => void;
};

const DEFAULT_INPUT_SIZE = 192;
const LEFT_ANKLE = 15;
const RIGHT_ANKLE = 16;
const MOVENET_KEYPOINT_VALUES = 17 * 3;

function tensorElementCount(shape: number[]) {
  return shape.reduce((total, value) => total * Math.max(1, Math.round(value)), 1);
}

function inferSquareInputSize(shape: number[]) {
  const dimensions = shape.map((value) => Math.round(value)).filter((value) => value >= 32);
  if (dimensions.length < 2) return DEFAULT_INPUT_SIZE;
  return Math.min(dimensions[0] ?? DEFAULT_INPUT_SIZE, dimensions[1] ?? DEFAULT_INPUT_SIZE);
}

function readFloatKeypoint(values: Float32Array, index: number) {
  "worklet";
  const offset = index * 3;
  if (offset + 2 >= values.length) return undefined;
  return {
    y: values[offset] ?? 0,
    x: values[offset + 1] ?? 0,
    score: values[offset + 2] ?? 0,
  };
}

function readByteKeypoint(values: Uint8Array, index: number) {
  "worklet";
  const offset = index * 3;
  if (offset + 2 >= values.length) return undefined;
  return {
    y: (values[offset] ?? 0) / 255,
    x: (values[offset + 1] ?? 0) / 255,
    score: (values[offset + 2] ?? 0) / 255,
  };
}

function clamp01(value: number) {
  "worklet";
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function OnDeviceVolleyCamera({
  width,
  height,
  modelAsset,
  showStatusBadge = false,
  onFootDetected,
  onInferenceStatus,
}: OnDeviceVolleyCameraProps) {
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const [modelError, setModelError] = useState<string | null>(null);
  const { inferenceFps, setModelReady } = usePosePipelineStore();
  const modelState = useTensorflowModel(modelAsset ?? 0, []);
  const model = modelState.state === "loaded" ? modelState.model : undefined;
  const boxedModel = useMemo(() => (model ? NitroModules.box(model) : undefined), [model]);
  const inputMetadata = useMemo(() => {
    const inputTensor = model?.inputs[0];
    const inputSize = inputTensor ? inferSquareInputSize(inputTensor.shape) : DEFAULT_INPUT_SIZE;
    const expectedBytes = inputSize * inputSize * 3;
    return {
      inputSize,
      expectedBytes,
      label: inputTensor ? `${inputTensor.dataType} ${inputTensor.shape.join("x")}` : "MoveNet uint8 input",
    };
  }, [model]);
  const outputMetadata = useMemo(() => {
    const outputTensor = model?.outputs.find((output) => tensorElementCount(output.shape) >= MOVENET_KEYPOINT_VALUES);
    return {
      index: outputTensor ? model?.outputs.indexOf(outputTensor) ?? 0 : 0,
      dataType: outputTensor?.dataType ?? "float32",
      label: outputTensor ? `${outputTensor.dataType} ${outputTensor.shape.join("x")}` : "output: unknown",
    };
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
      setModelError("MoveNet model asset is not configured yet.");
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

    runAtTargetFps(12, () => {
      "worklet";
      const input = resize(frame, {
        scale: { width: inputMetadata.inputSize, height: inputMetadata.inputSize },
        mirror: true,
        pixelFormat: "rgb",
        dataType: "uint8",
      });

      if (input.byteLength !== inputMetadata.expectedBytes) {
        reportStatus(true, 0, `movenet-input-size-${input.byteLength}`);
        return;
      }

      const inputBuffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
      const tflite = boxedModel.unbox();
      const outputs = tflite.runSync([inputBuffer]);
      const output = outputs[outputMetadata.index] ?? outputs[0];

      if (output == null) {
        reportStatus(true, 0, "movenet-output-missing");
        return;
      }

      let leftFoot:
        | {
            x: number;
            y: number;
            score: number;
          }
        | undefined;
      let rightFoot:
        | {
            x: number;
            y: number;
            score: number;
          }
        | undefined;

      if (output.byteLength >= MOVENET_KEYPOINT_VALUES * 4 && output.byteLength % 4 === 0) {
        const values = new Float32Array(output);
        leftFoot = readFloatKeypoint(values, LEFT_ANKLE);
        rightFoot = readFloatKeypoint(values, RIGHT_ANKLE);
      } else if (output.byteLength >= MOVENET_KEYPOINT_VALUES) {
        const values = new Uint8Array(output);
        leftFoot = readByteKeypoint(values, LEFT_ANKLE);
        rightFoot = readByteKeypoint(values, RIGHT_ANKLE);
      } else {
        reportStatus(true, 0, `movenet-output-short-${output.byteLength}`);
        return;
      }

      const bestFoot = (leftFoot?.score ?? 0) >= (rightFoot?.score ?? 0) ? leftFoot : rightFoot;
      if (!bestFoot) {
        reportStatus(true, 0, "movenet-ankle-missing");
        return;
      }

      const confidence = clamp01(bestFoot.score);
      reportStatus(true, confidence);
      if (confidence < 0.2) return;
      reportFoot(clamp01(bestFoot.x) * width, clamp01(bestFoot.y) * height, confidence);
    });
  }, [boxedModel, inputMetadata, outputMetadata, reportFoot, reportStatus, resize, width, height]);

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
          <Text style={styles.badgeText}>ON-DEVICE AI</Text>
          <Text style={styles.badgeSubText}>
            {model ? `MoveNet Lightning / ${Math.round(inferenceFps)}fps` : modelError ?? "Loading model"}
          </Text>
          {model && <Text style={styles.badgeSubText}>{inputMetadata.label}</Text>}
          {model && <Text style={styles.badgeSubText}>{outputMetadata.label}</Text>}
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
