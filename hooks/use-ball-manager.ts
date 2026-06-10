import { useState, useCallback, useRef, useEffect } from 'react';
import {
  BallState,
  BallAnimationConfig,
  CollisionResult,
  KickEffect,
  GameDifficulty,
  DIFFICULTY_PARAMS,
  GameScore,
} from '@/lib/types/ball';
import { Keypoint } from '@/lib/types/pose';

/**
 * ボール管理フック
 * ボール生成、アニメーション、衝突判定を管理
 */
export function useBallManager(
  screenWidth: number,
  screenHeight: number,
  difficulty: GameDifficulty = GameDifficulty.NORMAL
) {
  const [balls, setBalls] = useState<BallState[]>([]);
  const [effects, setEffects] = useState<KickEffect[]>([]);
  const [score, setScore] = useState<GameScore>({
    totalScore: 0,
    comboCount: 0,
    lastKickTime: 0,
    kickCount: 0,
    accuracyPercentage: 0,
  });

  const ballIdRef = useRef(0);
  const effectIdRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const difficultyParams = DIFFICULTY_PARAMS[difficulty];

  /**
   * ボールを生成
   */
  const spawnBall = useCallback(() => {
    const now = Date.now();

    // スポーン間隔をチェック
    if (now - lastSpawnTimeRef.current < difficultyParams.spawnInterval) {
      return;
    }

    lastSpawnTimeRef.current = now;

    const ballId = `ball-${ballIdRef.current++}`;
    const startX = Math.random() * (screenWidth - 40) + 20;
    const startY = -20;

    // ランダムなターゲット位置
    const targetX = Math.random() * (screenWidth - 40) + 20;
    const targetY = screenHeight + 20;

    const config: BallAnimationConfig = {
      initialX: startX,
      initialY: startY,
      targetX,
      targetY,
      duration: 3000 / difficultyParams.ballSpeed,
      gravity: difficultyParams.gravity,
      initialVelocity: 2,
    };

    const newBall: BallState = {
      id: ballId,
      x: config.initialX,
      y: config.initialY,
      vx: (config.targetX - config.initialX) / (config.duration / 16),
      vy: config.initialVelocity,
      radius: 15,
      isActive: true,
      createdAt: now,
    };

    setBalls((prev) => [...prev, newBall]);
  }, [screenWidth, screenHeight, difficultyParams]);

  /**
   * ボールを更新（アニメーション）
   */
  const updateBalls = useCallback(() => {
    setBalls((prev) =>
      prev
        .map((ball) => {
          if (!ball.isActive) return ball;

          const elapsed = Date.now() - ball.createdAt;

          // ボールが画面外に出たら非アクティブ化
          if (
            ball.y > screenHeight + 50 ||
            ball.x < -50 ||
            ball.x > screenWidth + 50
          ) {
            return { ...ball, isActive: false };
          }

          // 重力を適用
          const newVy = ball.vy + difficultyParams.gravity;

          return {
            ...ball,
            x: ball.x + ball.vx,
            y: ball.y + newVy,
            vy: newVy,
          };
        })
        .filter((ball) => ball.isActive)
    );
  }, [screenWidth, screenHeight, difficultyParams]);

  /**
   * 衝突判定
   */
  const checkCollision = useCallback(
    (anklePosition: Keypoint | null): CollisionResult => {
      if (!anklePosition) {
        return {
          hasCollision: false,
          ballId: null,
          collisionPoint: null,
          collisionForce: 0,
        };
      }

      const ankleX = anklePosition.x * screenWidth;
      const ankleY = anklePosition.y * screenHeight;
      const targetRadius = difficultyParams.targetRadius;

      for (const ball of balls) {
        if (!ball.isActive) continue;

        const dx = ball.x - ankleX;
        const dy = ball.y - ankleY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < targetRadius + ball.radius) {
          const collisionForce = Math.max(
            0,
            1 - distance / (targetRadius + ball.radius)
          );

          return {
            hasCollision: true,
            ballId: ball.id,
            collisionPoint: { x: ball.x, y: ball.y },
            collisionForce,
          };
        }
      }

      return {
        hasCollision: false,
        ballId: null,
        collisionPoint: null,
        collisionForce: 0,
      };
    },
    [balls, screenWidth, screenHeight, difficultyParams]
  );

  /**
   * ボールをキック（消去とエフェクト生成）
   */
  const kickBall = useCallback(
    (ballId: string, collisionPoint: { x: number; y: number } | null) => {
      if (!collisionPoint) return;

      // ボールを削除
      setBalls((prev) =>
        prev.map((ball) =>
          ball.id === ballId ? { ...ball, isActive: false } : ball
        )
      );

      // キック成功エフェクトを生成
      const effectId = `effect-${effectIdRef.current++}`;
      const effect: KickEffect = {
        id: effectId,
        x: collisionPoint.x,
        y: collisionPoint.y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 2,
        lifetime: 500,
        createdAt: Date.now(),
        type: 'particle',
      };

      setEffects((prev) => [...prev, effect]);

      // スコア更新
      setScore((prev) => ({
        ...prev,
        totalScore: prev.totalScore + 10 + Math.floor(prev.comboCount * 5),
        comboCount: prev.comboCount + 1,
        lastKickTime: Date.now(),
        kickCount: prev.kickCount + 1,
      }));
    },
    []
  );

  /**
   * エフェクトを更新
   */
  const updateEffects = useCallback(() => {
    setEffects((prev) => {
      const now = Date.now();
      return prev
        .map((effect) => {
          const age = now - effect.createdAt;
          if (age > effect.lifetime) return null;

          return {
            ...effect,
            x: effect.x + effect.vx,
            y: effect.y + effect.vy,
            vy: effect.vy + 0.2, // 重力
          };
        })
        .filter((e) => e !== null) as KickEffect[];
    });
  }, []);

  /**
   * コンボをリセット
   */
  const resetCombo = useCallback(() => {
    setScore((prev) => ({
      ...prev,
      comboCount: 0,
    }));
  }, []);

  /**
   * ゲームをリセット
   */
  const resetGame = useCallback(() => {
    setBalls([]);
    setEffects([]);
    setScore({
      totalScore: 0,
      comboCount: 0,
      lastKickTime: 0,
      kickCount: 0,
      accuracyPercentage: 0,
    });
    ballIdRef.current = 0;
    effectIdRef.current = 0;
    lastSpawnTimeRef.current = 0;
  }, []);

  return {
    balls,
    effects,
    score,
    spawnBall,
    updateBalls,
    checkCollision,
    kickBall,
    updateEffects,
    resetCombo,
    resetGame,
  };
}
