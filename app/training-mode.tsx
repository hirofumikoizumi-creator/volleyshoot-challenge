import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { GameCamera } from '@/components/game-camera';
import { generateDummyPoseData, calculateDistance } from '@/lib/pose-processor';
import { useRouter } from 'expo-router';
import { useGameContext } from '@/lib/game-context';
import { DIFFICULTY_CONFIG, getRandomBallType, BALL_TYPE_CONFIG } from '@/lib/game-config';
import { generateRandomTrajectory } from '@/lib/ball-physics';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

interface Ball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'NORMAL' | 'BLUE' | 'GOLD';
}

interface PoseData {
  landmarks: Array<{ x: number; y: number; z: number; visibility: number }>;
}

const GAME_CONFIG = {
  screenWidth: width,
  screenHeight: height,
};

export default function TrainingModeScreen() {
  const router = useRouter();
  const { gameState } = useGameContext();
  const [score, setScore] = useState(0);
  const [poseData, setPoseData] = useState<PoseData | null>(null);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [combo, setCombo] = useState(0);
  const [lastComboTime, setLastComboTime] = useState(0);
  const [kickCount, setKickCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [soundLoaded, setSoundLoaded] = useState(false);

  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ballIdRef = useRef(0);
  const lastBallTimeRef = useRef(Date.now());
  const soundRef = useRef<any>(null);

  // 効果音を読み込む
  useEffect(() => {
    loadSound();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const loadSound = async () => {
    try {
      // 効果音の読み込みはスキップ（実装予定）
      setSoundLoaded(true);
    } catch (error) {
      console.warn('Failed to load sound:', error);
    }
  };

  const playKickSound = async () => {
    if (soundLoaded) {
      try {
        // 効果音再生（実装予定）
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.warn('Failed to play sound:', error);
      }
    }
  };

  // ボール生成ロジック
  const generateBall = () => {
    const now = Date.now();
    if (now - lastBallTimeRef.current < 1500) return;

    lastBallTimeRef.current = now;

    const trajectory = generateRandomTrajectory(width, height, 'NORMAL');
    const ballType = getRandomBallType('TRAINING');

    const newBall: Ball = {
      id: `ball-${ballIdRef.current++}`,
      x: trajectory.initialX,
      y: trajectory.initialY,
      vx: trajectory.initialVx,
      vy: trajectory.initialVy,
      radius: 15,
      type: ballType,
    };

    setBalls((prev) => [...prev, newBall]);
  };

  // ゲームループ
  useEffect(() => {
    gameLoopRef.current = setInterval(() => {
      if (!isActive) return;

      // ボール生成
      generateBall();

      // ボール更新
      setBalls((prevBalls) => {
        const updatedBalls = prevBalls
          .map((ball) => {
            const gravity = DIFFICULTY_CONFIG['TRAINING'].gravity;
            const airResistance = DIFFICULTY_CONFIG['TRAINING'].airResistance;

            return {
              ...ball,
              x: ball.x + ball.vx,
              y: ball.y + ball.vy,
              vx: ball.vx * (1 - airResistance),
              vy: ball.vy + gravity,
            };
          })
          .filter((ball) => ball.y < height + 100);

        // キック判定
        if (poseData && poseData.landmarks.length > 0) {
          const leftAnkle = poseData.landmarks[27]; // 左足首
          const rightAnkle = poseData.landmarks[28]; // 右足首

          updatedBalls.forEach((ball, index) => {
            if (!ball) return;

            const ankleX = (leftAnkle?.x || 0 + rightAnkle?.x || 0) / 2;
            const ankleY = (leftAnkle?.y || 0 + rightAnkle?.y || 0) / 2;

            const distance = calculateDistance(
              { x: ball.x, y: ball.y },
              { x: ankleX * width, y: ankleY * height }
            );

            if (distance < 50) {
              // キック成功
              playKickSound();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

              const points = BALL_TYPE_CONFIG[ball.type].points;
              setScore((prev) => prev + points);
              setSuccessCount((prev) => prev + 1);
              setKickCount((prev) => prev + 1);

              // コンボ更新
              const now = Date.now();
              if (now - lastComboTime < 3000) {
                setCombo((prev) => prev + 1);
              } else {
                setCombo(1);
              }
              setLastComboTime(now);

              // ボール削除
              updatedBalls.splice(index, 1);
            }
          });
        }

        return updatedBalls;
      });
    }, 30);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [poseData, isActive, lastComboTime]);

  const handlePause = () => {
    setIsActive(!isActive);
  };

  const handleExit = () => {
    router.back();
  };

  const successRate = kickCount > 0 ? successCount / kickCount : 0;

  return (
    <ScreenContainer className="bg-[#0A0E27]" edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.container}>
        {/* カメラビュー */}
        <View style={styles.cameraContainer}>
          <GameCamera poseData={poseData} showKeypoints={true} />

          {/* ボール描画 */}
          {balls.map((ball) => (
            <View
              key={ball.id}
              style={[
                styles.ball,
                {
                  left: ball.x - ball.radius,
                  top: ball.y - ball.radius,
                  width: ball.radius * 2,
                  height: ball.radius * 2,
                  backgroundColor:
                    ball.type === 'BLUE' ? '#0099FF' : ball.type === 'GOLD' ? '#FFD700' : '#FFFFFF',
                },
              ]}
            />
          ))}
        </View>

        {/* スコア表示 */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>スコア</Text>
            <Text style={styles.statValue}>{score}</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>キック数</Text>
            <Text style={styles.statValue}>{kickCount}</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>成功率</Text>
            <Text style={styles.statValue}>{(successRate * 100).toFixed(0)}%</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>コンボ</Text>
            <Text style={styles.statValue}>{combo}</Text>
          </View>
        </View>

        {/* コントロールボタン */}
        <View style={styles.controlContainer}>
          <TouchableOpacity style={styles.pauseButton} onPress={handlePause}>
            <Text style={styles.controlButtonText}>{isActive ? '⏸ 一時停止' : '▶ 再開'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
            <Text style={styles.controlButtonText}>✕ 終了</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  ball: {
    position: 'absolute',
    borderRadius: 50,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 14, 39, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.2)',
  },
  statLabel: {
    fontSize: 10,
    color: '#AAAAAA',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00D9FF',
  },
  controlContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 14, 39, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 217, 255, 0.2)',
  },
  pauseButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  exitButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  controlButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
