import { create } from "zustand";
import type { PoseFrame } from "./blazepose-types";

type PosePipelineState = {
  latestPose?: PoseFrame;
  debugOverlayEnabled: boolean;
  modelReady: boolean;
  inferenceFps: number;
  setLatestPose: (pose: PoseFrame) => void;
  setDebugOverlayEnabled: (enabled: boolean) => void;
  setModelReady: (ready: boolean) => void;
  setInferenceFps: (fps: number) => void;
};

export const usePosePipelineStore = create<PosePipelineState>((set) => ({
  latestPose: undefined,
  debugOverlayEnabled: true,
  modelReady: false,
  inferenceFps: 0,
  setLatestPose: (pose) => set({ latestPose: pose }),
  setDebugOverlayEnabled: (debugOverlayEnabled) => set({ debugOverlayEnabled }),
  setModelReady: (modelReady) => set({ modelReady }),
  setInferenceFps: (inferenceFps) => set({ inferenceFps }),
}));
