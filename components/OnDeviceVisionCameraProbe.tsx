import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Camera, useCameraDevice, useCameraPermission } from "react-native-vision-camera";

type OnDeviceVisionCameraProbeProps = {
  width: number;
  height: number;
  onStatus?: (status: string) => void;
};

export function OnDeviceVisionCameraProbe({ width, height, onStatus }: OnDeviceVisionCameraProbeProps) {
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
      onStatus?.("vision-camera-permission");
      return;
    }
    onStatus?.(device ? "vision-camera-ready" : "vision-camera-no-device");
  }, [device, hasPermission, onStatus, requestPermission]);

  if (!hasPermission || !device) {
    return (
      <View style={[styles.fallback, { width, height }]}>
        <Text style={styles.fallbackTitle}>
          {!hasPermission ? "VisionCamera 許可確認中" : "VisionCamera デバイス確認中"}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive resizeMode="cover" />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>VISION CAMERA OK</Text>
        <Text style={styles.badgeSubText}>Frame processor は未使用</Text>
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
    borderColor: "rgba(0,217,255,0.42)",
  },
  badgeText: {
    color: "#00D9FF",
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
