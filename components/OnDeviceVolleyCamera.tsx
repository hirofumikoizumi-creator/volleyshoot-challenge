import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from "react-native-vision-camera";
import { loadTensorflowModel } from "react-native-fast-tflite";
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
};

export function OnDeviceVolleyCamera({ width, height, modelAsset, latestPose, showStatusBadge = false }: OnDeviceVolleyCameraProps) {
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const { debugOverlayEnabled, inferenceFps, setModelReady } = usePosePipelineStore();

  useEffect(() => {
    let mounted = true;
    setModelLoaded(false);
    setModelReady(false);
    setModelError(null);

    if (!modelAsset) {
      setModelError("BlazePose Lite model asset is not configured yet.");
      return;
    }

    loadTensorflowModel(modelAsset, ["core-ml"])
      .then(() => {
        if (!mounted) return;
        setModelLoaded(true);
        setModelReady(true);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setModelError(error instanceof Error ? error.message : "Failed to load BlazePose Lite model.");
        setModelReady(false);
      });

    return () => {
      mounted = false;
    };
  }, [modelAsset, setModelReady]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const privacy = useMemo(() => assertNoNetworkFrameTransport(), []);

  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";
    // The production path runs BlazePose Lite here once the bundled .tflite asset
    // is present. Camera frames remain on-device and are never uploaded.
    void frame;
  }, []);

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
            {modelLoaded ? `BlazePose Lite / ${Math.round(inferenceFps)}fps` : modelError ?? "Loading model"}
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
