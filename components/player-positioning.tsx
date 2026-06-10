import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { PoseData } from '@/lib/types/pose';

const { width, height } = Dimensions.get('window');

interface PlayerPositioningProps {
  poseData: PoseData | null;
  onPositioningComplete: () => void;
}

export function PlayerPositioning({ poseData, onPositioningComplete }: PlayerPositioningProps) {
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const [isInPosition, setIsInPosition] = useState(false);

  // プレイヤーが最適な位置にいるか判定
  useEffect(() => {
    if (!poseData || !poseData.landmarks || poseData.landmarks.length < 34) {
      setIsInPosition(false);
      return;
    }

    // 両肩のキーポイント（インデックス 11, 12）
    const leftShoulder = poseData.landmarks[11];
    const rightShoulder = poseData.landmarks[12];

    if (!leftShoulder || !rightShoulder) {
      setIsInPosition(false);
      return;
    }

    // 両肩がカメラフレーム内にあり、適切な高さにあるか判定
    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;

    // 最適な位置：画面中央、上から30-70%の範囲
    const isInCenterX = shoulderX > 0.3 && shoulderX < 0.7;
    const isInCenterY = shoulderY > 0.2 && shoulderY < 0.6;
    const isVisible = (leftShoulder.z ?? 0) > 0.5 && (rightShoulder.z ?? 0) > 0.5;

    setIsInPosition(isInCenterX && isInCenterY && isVisible);
  }, [poseData]);

  // カウントダウン処理
  useEffect(() => {
    if (!isInPosition) {
      setCountdownSeconds(5);
      return;
    }

    if (countdownSeconds <= 0) {
      onPositioningComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCountdownSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isInPosition, countdownSeconds, onPositioningComplete]);

  return (
    <View style={styles.container}>
      {/* ガイド枠 */}
      <View
        style={[
          styles.guidanceFrame,
          {
            borderColor: isInPosition ? '#00D9FF' : '#FF6B6B',
            borderWidth: isInPosition ? 3 : 2,
          },
        ]}
      >
        <Text style={styles.frameLabel}>
          {isInPosition ? '✓ 最適な位置です' : 'ここに立ってください'}
        </Text>
      </View>

      {/* ステータス表示 */}
      <View style={styles.statusContainer}>
        {!isInPosition && (
          <>
            <Text style={styles.statusText}>📍 位置を調整してください</Text>
            <Text style={styles.instructionText}>
              肩がフレーム内の中央に来るように立ってください
            </Text>
          </>
        )}

        {isInPosition && countdownSeconds > 0 && (
          <>
            <Text style={styles.statusText}>✓ 準備完了！</Text>
            <Text style={styles.countdownText}>{countdownSeconds}</Text>
            <Text style={styles.instructionText}>ゲーム開始まで {countdownSeconds} 秒</Text>
          </>
        )}
      </View>

      {/* コーナーマーク */}
      <View style={[styles.cornerMark, styles.topLeft]} />
      <View style={[styles.cornerMark, styles.topRight]} />
      <View style={[styles.cornerMark, styles.bottomLeft]} />
      <View style={[styles.cornerMark, styles.bottomRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 100,
  },
  guidanceFrame: {
    width: width * 0.6,
    height: height * 0.5,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  frameLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    gap: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  countdownText: {
    color: '#00D9FF',
    fontSize: 48,
    fontWeight: '900',
    textAlign: 'center',
    width: 80,
    height: 80,
    lineHeight: 80,
  },
  instructionText: {
    color: '#B0B0B0',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  cornerMark: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#00D9FF',
    borderWidth: 2,
  },
  topLeft: {
    top: 20,
    left: 20,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 20,
    right: 20,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 20,
    left: 20,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 20,
    right: 20,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
});
