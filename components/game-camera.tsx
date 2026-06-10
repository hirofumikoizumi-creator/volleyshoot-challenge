import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { PoseData, Keypoint } from '@/lib/types/pose';

interface GameCameraProps {
  onPoseDetected?: (pose: PoseData) => void;
  poseData?: PoseData | null;
  showKeypoints?: boolean;
}

export const GameCamera = React.forwardRef<CameraView, GameCameraProps>(
  ({ onPoseDetected, poseData, showKeypoints = true }, ref) => {
    const cameraRef = useRef<CameraView>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [cameraReady, setCameraReady] = useState(false);

    useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') {
          ref(cameraRef.current);
        } else {
          ref.current = cameraRef.current;
        }
      }
    }, [ref]);

    // カメラパーミッション確認と要求
    useEffect(() => {
      if (permission === null) {
        // パーミッション状態がまだ確認されていない
        return;
      }

      if (!permission.granted) {
        // パーミッションがない場合、要求する
        requestPermission();
      }
    }, [permission, requestPermission]);

    const renderKeypoints = () => {
      if (!poseData || !showKeypoints) return null;
      // Skiaレンダリングはここに実装予定
      // Canvas, Circle, Groupコンポーネントを使用
      return null;
    };

    // パーミッション未取得時の表示
    if (!permission) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>カメラパーミッションを確認中...</Text>
        </View>
      );
    }

    // パーミッション拒否時の表示
    if (!permission.granted) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>カメラへのアクセスが必要です</Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => {
              // 設定アプリを開く
              Linking.openSettings();
            }}
          >
            <Text style={styles.permissionButtonText}>設定を開く</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          onCameraReady={() => {
            console.log('Camera ready');
            setCameraReady(true);
          }}
          onMountError={(error) => {
            console.error('Camera mount error:', error);
          }}
        />
        {/* Skiaキーポイント描画 */}
        {renderKeypoints()}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0A0E27',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#00D9FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#0A0E27',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

GameCamera.displayName = 'GameCamera';
