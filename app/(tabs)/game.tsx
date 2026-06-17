import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { GameCamera } from '@/components/game-camera';
import { PlayerPositioning } from '@/components/player-positioning';
import { generateDummyPoseData, calculateDistance } from '@/lib/pose-processor';
import {
  generateRandomTrajectory,
  updateBallPhysics,
  isBallInScreen,
  type BallPhysicsConfig,
} from '@/lib/ball-physics';
import { PoseData } from '@/lib/types/pose';
import { useGameContext } from '@/lib/game-context';
import { useSoundManager } from '@/hooks/use-sound-manager';
import { useParticles } from '@/hooks/use-particles';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

import { BallType, BALL_TYPE_CONFIG, DIFFICULTY_CONFIG } from '@/lib/game-config';

interface Ball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
  type: BallType;
}

const DIFFICULTY_SCORE_MULTIPLIER = {
  EASY: 1,
  NORMAL: 1.5,
  HARD: 2,
} as const;

export default function GameScreen() {
  const router = useRouter();
  const { gameState, setGameState } = useGameContext();
  const [score, setScore] = useState(0);
  const [isGameActive, setIsGameActive] = useState(false);
  const [isPositioningComplete, setIsPositioningComplete] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(
    DIFFICULTY_CONFIG[gameState?.difficulty || 'NORMAL'].timeLimit
  );
  const [poseData, setPoseData] = useState<PoseData | null>(null);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [totalBalls, setTotalBalls] = useState(0);
  const [lastComboTime, setLastComboTime] = useState(0);
  const { playKickSuccess, playCombo } = useSoundManager();
  const { particles, createBallBurstEffect, createKickSuccessEffect, createComboEffect } = useParticles();

  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ballIdRef = useRef(0);
  const lastBallTimeRef = useRef(Date.now());

  const difficulty = gameState?.difficulty || 'NORMAL';

  const generatePositioningPoseData = () => {
    const pose = generateDummyPoseData();
    pose.landmarks[11] = { ...pose.landmarks[11], x: 0.45, y: 0.4, z: 1, visibility: 1 };
    pose.landmarks[12] = { ...pose.landmarks[12], x: 0.55, y: 0.4, z: 1, visibility: 1 };
    return pose;
  };

  const generateBall = () => {
    const now = Date.now();
    if (now - lastBallTimeRef.current < DIFFICULTY_CONFIG[difficulty].ballSpawnInterval) return;

    lastBallTimeRef.current = now;

    const trajectory = generateRandomTrajectory(width, height, difficulty);

    const newBall: Ball = {
      id: `ball-${ballIdRef.current++}`,
      x: trajectory.initialX,
      y: trajectory.initialY,
      vx: trajectory.initialVx,
      vy: trajectory.initialVy,
      radius: 12,
      active: true,
      type: trajectory.type,
    };

    setBalls((prev) => [...prev, newBall]);
    setTotalBalls((prev) => prev + 1);
  };

  const updateBalls = (pose: PoseData | null) => {
    setBalls((prevBalls) => {
      let updated = prevBalls
        .map((ball) => {
          const difficultyConfig = DIFFICULTY_CONFIG[difficulty];
          const physicsConfig: BallPhysicsConfig = {
            gravity: difficultyConfig.gravity,
            airResistance: difficultyConfig.airResistance,
            screenWidth: width,
            screenHeight: height,
          };
          const physics = updateBallPhysics(ball.x, ball.y, ball.vx, ball.vy, physicsConfig);

          return {
            ...ball,
            x: physics.x,
            y: physics.y,
            vx: physics.vx,
            vy: physics.vy,
          };
        })
        .filter((ball) => isBallInScreen(ball.x, ball.y, ball.radius, width, height));

      // キック判定
      if (pose && pose.landmarks && pose.landmarks.length > 0) {
        const rightAnkle = pose.landmarks[32];
        const leftAnkle = pose.landmarks[31];

        updated = updated.map((ball) => {
          if (!ball.active) return ball;

          const rightDist = rightAnkle
            ? Math.sqrt((rightAnkle.x * width - ball.x) ** 2 + (rightAnkle.y * height - ball.y) ** 2)
            : Infinity;
          const leftDist = leftAnkle
            ? Math.sqrt((leftAnkle.x * width - ball.x) ** 2 + (leftAnkle.y * height - ball.y) ** 2)
            : Infinity;

          if (rightDist < 50 || leftDist < 50) {
            const basePoints = BALL_TYPE_CONFIG[ball.type].points;
            const comboBonus = combo * 5;
            const totalPoints = Math.round(basePoints * DIFFICULTY_SCORE_MULTIPLIER[difficulty] + comboBonus);

            setScore((prev) => prev + totalPoints);
            setSuccessCount((prev) => prev + 1);
            setCombo((prev) => prev + 1);
            setMaxCombo((prev) => Math.max(prev, combo + 1));
            setLastComboTime(Date.now());

            playKickSuccess?.();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            createKickSuccessEffect?.(ball.x, ball.y);

            if (combo > 0 && combo % 5 === 0) {
              playCombo?.();
              createComboEffect?.(ball.x, ball.y, combo);
            }

            return { ...ball, active: false };
          }

          return ball;
        });
      }

      return updated;
    });
  };

  useEffect(() => {
    if (combo > 0 && Date.now() - lastComboTime > 2000) {
      setCombo(0);
    }
  }, [combo, lastComboTime]);

  useEffect(() => {
    if (isPositioningComplete || isGameActive) return;

    setPoseData(generatePositioningPoseData());

    const positioningLoop = setInterval(() => {
      setPoseData(generatePositioningPoseData());
    }, 250);

    return () => clearInterval(positioningLoop);
  }, [isPositioningComplete, isGameActive]);

  useEffect(() => {
    if (!isGameActive) return;

    setPoseData(generateDummyPoseData());
    generateBall();

    gameLoopRef.current = setInterval(() => {
      const updated = generateDummyPoseData();
      setPoseData(updated);
      generateBall();
      updateBalls(updated);
    }, 50);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isGameActive]);

  useEffect(() => {
    if (!isGameActive || timeRemaining <= 0) {
      setIsGameActive(false);
      return;
    }

    const timer = setTimeout(() => {
      setTimeRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isGameActive, timeRemaining]);

  const handlePause = () => {
    setIsGameActive(!isGameActive);
  };

  const handleShowResult = () => {
    setGameState({
      difficulty,
      score,
      successCount,
      totalBalls,
      maxCombo,
    });
    router.push('/game-result');
  };

  if (!isGameActive && timeRemaining <= 0) {
    return (
      <ScreenContainer
        className="bg-[#0A0E27] justify-center items-center"
        edges={['top', 'left', 'right', 'bottom']}
      >
        <LinearGradient
          colors={['rgba(0, 217, 255, 0.1)', 'rgba(10, 14, 39, 0.5)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.endGameContainer}
        >
          <Text style={styles.endGameTitle}>🎮 ゲーム終了</Text>
          <View style={styles.finalScoreContainer}>
            <Text style={styles.finalScoreLabel}>最終スコア</Text>
            <Text style={styles.finalScore}>{score}</Text>
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>最大コンボ</Text>
              <Text style={styles.statValue}>{maxCombo}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>成功数</Text>
              <Text style={styles.statValue}>{successCount}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.replayButton}
            onPress={handleShowResult}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>結果を見る</Text>
          </TouchableOpacity>
        </LinearGradient>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-[#0A0E27]" edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.cameraContainer}>
          <GameCamera poseData={poseData} showKeypoints={true} />
          
          {/* プレイヤーポジショニング */}
          {!isPositioningComplete && (
            <PlayerPositioning
              poseData={poseData}
              onPositioningComplete={() => {
                setIsPositioningComplete(true);
                setIsGameActive(true);
              }}
            />
          )}

          {/* ボール描画 */}
          {balls.map((ball) => (
            <View key={ball.id} style={styles.ballContainer}>
              <View
                style={[
                  styles.ball,
                  {
                    left: Math.max(0, Math.min(ball.x - ball.radius, width - ball.radius * 2)),
                    top: Math.max(0, Math.min(ball.y - ball.radius, height - ball.radius * 2)),
                    width: ball.radius * 2,
                    height: ball.radius * 2,
                    opacity: ball.active ? 1 : 0.6,
                    backgroundColor: ball.type === 'NORMAL' ? '#FFFFFF' : ball.type === 'BLUE' ? '#3B82F6' : '#FFD700',
                    shadowColor: ball.type === 'NORMAL' ? '#FFD700' : ball.type === 'BLUE' ? '#3B82F6' : '#FFA500',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: ball.type === 'NORMAL' ? 0.3 : ball.type === 'BLUE' ? 0.5 : 0.6,
                    shadowRadius: 8,
                    elevation: 8,
                  },
                ]}
              >
                {ball.type === 'NORMAL' && (
                  <>
                    <View style={styles.ballPattern1} />
                    <View style={styles.ballPattern2} />
                  </>
                )}
                {ball.type === 'BLUE' && (
                  <>
                    <View style={[styles.ballPattern1, { backgroundColor: '#1E40AF' }]} />
                    <View style={[styles.ballPattern2, { backgroundColor: '#1E40AF' }]} />
                    <View style={[styles.ballPattern1, { backgroundColor: '#1E40AF', top: 8, left: 8 }]} />
                  </>
                )}
                {ball.type === 'GOLD' && (
                  <>
                    <View style={[styles.ballPattern1, { backgroundColor: '#B8860B' }]} />
                    <View style={[styles.ballPattern2, { backgroundColor: '#B8860B' }]} />
                    <View style={[styles.ballPattern1, { backgroundColor: '#B8860B', top: 8, left: 8 }]} />
                    <View style={[styles.ballPattern2, { backgroundColor: '#B8860B', bottom: 2, right: 2 }]} />
                  </>
                )}
              </View>
            </View>
          ))}

          {/* スコア表示（改善版） */}
          <View style={styles.scoreOverlay}>
            <LinearGradient
              colors={['rgba(0, 217, 255, 0.9)', 'rgba(10, 122, 164, 0.8)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.scoreGradient}
            >
              <Text style={styles.scoreLabel}>スコア</Text>
              <Text style={styles.scoreText}>{score}</Text>
            </LinearGradient>
          </View>

          {/* コンボ表示（改善版） */}
          {combo > 0 && (
            <View style={styles.comboOverlay}>
              <LinearGradient
                colors={['rgba(255, 215, 0, 0.95)', 'rgba(255, 165, 0, 0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.comboGradient}
              >
                <Text style={styles.comboTextOverlay}>🔥 {combo} COMBO 🔥</Text>
              </LinearGradient>
            </View>
          )}

          {/* タイマー表示（改善版） */}
          <View style={styles.timerOverlay}>
            <LinearGradient
              colors={timeRemaining <= 10 ? ['rgba(255, 107, 107, 0.9)', 'rgba(239, 68, 68, 0.8)'] : ['rgba(76, 175, 80, 0.9)', 'rgba(56, 142, 60, 0.8)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.timerGradient}
            >
              <Text style={styles.timerLabel}>⏱️</Text>
              <Text style={styles.timerText}>{timeRemaining}</Text>
            </LinearGradient>
          </View>

          {/* 一時停止ボタン */}
          <TouchableOpacity style={styles.pauseButton} onPress={handlePause} activeOpacity={0.7}>
            <LinearGradient
              colors={['rgba(0, 217, 255, 0.8)', 'rgba(10, 122, 164, 0.7)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pauseButtonGradient}
            >
              <Text style={styles.pauseButtonText}>{isGameActive ? '⏸' : '▶'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  ballContainer: {
    position: 'absolute',
  },
  ball: {
    position: 'absolute',
    borderRadius: 12,
    elevation: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
  },
  ballPattern1: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#000000',
    borderRadius: 4,
    top: 4,
    left: 4,
  },
  ballPattern2: {
    position: 'absolute',
    width: 6,
    height: 6,
    backgroundColor: '#000000',
    borderRadius: 3,
    bottom: 4,
    right: 4,
  },
  scoreOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scoreGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  comboOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -30 }],
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 12,
  },
  comboGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  comboTextOverlay: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  timerOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  timerGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: 80,
  },
  timerLabel: {
    fontSize: 16,
  },
  timerText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  pauseButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  pauseButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  endGameContainer: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  endGameTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#00D9FF',
    marginBottom: 24,
  },
  finalScoreContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  finalScoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0B0B0',
    marginBottom: 8,
  },
  finalScore: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B0B0B0',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00D9FF',
  },
  replayButton: {
    backgroundColor: '#00D9FF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#00D9FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0E27',
  },
});
