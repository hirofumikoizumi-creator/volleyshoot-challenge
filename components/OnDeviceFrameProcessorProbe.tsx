import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Camera, runAtTargetFps, useCameraDevice, useCameraPermission, useFrameProcessor } from "react-native-vision-camera";
import { useRunOnJS } from "react-native-worklets-core";

type OnDeviceFrameProcessorProbeProps = {
  width: number;
  height: number;
  onStatus?: (status: string) => void;
};

export function OnDeviceFrameProcessorProbe({ width, height, onStatus }: OnDeviceFrameProcessorProbeProps) {
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const reportStatus = useRunOnJS((status: string) => {
    onStatus?.(status);
  }, [onStatus]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
      onStatus?.("frame-processor-permission");
      return;
    }
    onStatus?.(device ? "frame-processor-ready" : "frame-processor-no-device");
  }, [device, hasPermission, onStatus, requestPermission]);

  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";
    runAtTargetFps(5, () => {
      "worklet";
      reportStatus("noop-frame-ok");
    });
  }, [reportStatus]);

  if (!hasPermission || !device) {
    return (
      <View style={[styles.fallback, { width, height }]}>
        <Text style={styles.fallbackTitle}>
          {!hasPermission ? "FrameProcessor 許可確認中" : "FrameProcessor デバイス確認中"}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive resizeMode="cover" frameProcessor={frameProcessor} />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>FRAME TEST</Text>
        <Text style={styles.badgeSubText}>no-op frame processor / no resize / no TFLite</Text>
      </View>
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
    borderColor: "rgba(250,204,21,0.42)",
  },
  badgeText: {
    color: "#FACC15",
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
