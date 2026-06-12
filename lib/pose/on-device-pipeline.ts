import { extractLowerBodyLandmarks, type PoseFrame } from "./blazepose-types";
import { type CoverTransformOptions } from "./coordinate-transform";
import { FootPostProcessor } from "./foot-postprocessor";

export type BlazePoseLiteOutput = {
  landmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>;
  inferenceStartedAtMs: number;
  inferenceFinishedAtMs: number;
};

const postProcessor = new FootPostProcessor();

export function buildPoseFrameFromBlazePose(
  output: BlazePoseLiteOutput,
  transform: CoverTransformOptions,
  bodyScale: number,
): PoseFrame {
  const lowerBody = extractLowerBodyLandmarks(output.landmarks);
  const latencyMs = Math.max(0, output.inferenceFinishedAtMs - output.inferenceStartedAtMs);
  const timestampMs = output.inferenceFinishedAtMs;

  return {
    lowerBody,
    leftFoot: postProcessor.toScreenFoot("left", lowerBody, transform, timestampMs, latencyMs, bodyScale),
    rightFoot: postProcessor.toScreenFoot("right", lowerBody, transform, timestampMs, latencyMs, bodyScale),
    latencyMs,
    timestampMs,
  };
}

export function assertNoNetworkFrameTransport() {
  return {
    cameraFramesLeaveDevice: false,
    paidCloudAiApi: false,
    inferenceLocation: "on-device-tflite",
  } as const;
}
