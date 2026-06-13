import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTensorflowModel } from "react-native-fast-tflite";

type OnDeviceTfliteModelProbeProps = {
  width: number;
  height: number;
  modelAsset?: number;
  onStatus?: (status: { ready: boolean; label: string; error?: string }) => void;
};

export function OnDeviceTfliteModelProbe({ width, height, modelAsset, onStatus }: OnDeviceTfliteModelProbeProps) {
  const modelState = useTensorflowModel(modelAsset ?? 0, []);

  useEffect(() => {
    if (!modelAsset) {
      onStatus?.({ ready: false, label: "model-missing", error: "model-missing" });
      return;
    }
    if (modelState.state === "loaded") {
      onStatus?.({ ready: true, label: "model-loaded" });
      return;
    }
    if (modelState.state === "error") {
      onStatus?.({ ready: false, label: "model-error", error: modelState.error.message });
      return;
    }
    onStatus?.({ ready: false, label: "model-loading" });
  }, [modelAsset, modelState, onStatus]);

  const label =
    modelState.state === "loaded"
      ? "TFLite model loaded"
      : modelState.state === "error"
        ? modelState.error.message
        : "Loading TFLite model";

  return (
    <View style={[styles.root, { width, height }]}>
      <Text style={styles.title}>TFLITE MODEL TEST</Text>
      <Text style={modelState.state === "loaded" ? styles.ready : styles.status}>{label}</Text>
      <Text style={styles.note}>カメラと frame processor は未使用</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#030811",
    padding: 20,
  },
  title: {
    color: "#FACC15",
    fontSize: 14,
    fontWeight: "900",
  },
  status: {
    color: "#DCE7F3",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8,
    textAlign: "center",
  },
  ready: {
    color: "#A3FF12",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 8,
  },
  note: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
  },
});
