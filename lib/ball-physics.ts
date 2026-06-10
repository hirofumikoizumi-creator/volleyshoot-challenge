/**
 * サッカーボールの現実的な物理演算
 * 重力、空気抵抗、回転などを考慮
 */

import { BallType, getRandomBallType } from './game-config';

export interface BallPhysicsConfig {
  gravity: number; // 重力加速度（ピクセル/フレーム²）
  airResistance: number; // 空気抵抗係数（0-1）
  screenWidth: number;
  screenHeight: number;
}

export interface BallTrajectory {
  initialX: number;
  initialY: number;
  initialVx: number;
  initialVy: number;
  angle: number; // 発射角度（度）
  speed: number; // 初速度
  type: BallType; // ボール種別
}

/**
 * ボール生成時のランダムな軌道を生成
 * 左右からランダムに出現し、様々な角度・速度で飛んでくる
 */
export function generateRandomTrajectory(
  screenWidth: number,
  screenHeight: number,
  difficulty: 'EASY' | 'NORMAL' | 'HARD'
): BallTrajectory {
  // 左右ランダムに決定
  const fromLeft = Math.random() > 0.5;

  let initialX: number;
  let initialY: number;
  let initialVx: number;
  let initialVy: number;
  let angle: number;
  let speed: number;

  // 難易度に応じた速度範囲
  const speedConfig = {
    EASY: { min: 2, max: 4 },
    NORMAL: { min: 4, max: 8 },
    HARD: { min: 6, max: 10 },
  };

  const speedRange = speedConfig[difficulty];

  if (fromLeft) {
    // 左から出現
    initialX = -30;
    initialY = screenHeight * (0.2 + Math.random() * 0.6); // 高さ20-80%

    // 角度: 15度～60度（上向き）
    angle = 15 + Math.random() * 45;
    // 速度: 難易度に応じた範囲
    speed = speedRange.min + Math.random() * (speedRange.max - speedRange.min);

    // 右上方向へ発射
    initialVx = speed * Math.cos((angle * Math.PI) / 180);
    initialVy = -speed * Math.sin((angle * Math.PI) / 180); // 負=上向き
  } else {
    // 右から出現
    initialX = screenWidth + 30;
    initialY = screenHeight * (0.2 + Math.random() * 0.6); // 高さ20-80%

    // 角度: 120度～165度（上向き、左方向）
    angle = 120 + Math.random() * 45;
    // 速度: 難易度に応じた範囲
    speed = speedRange.min + Math.random() * (speedRange.max - speedRange.min);

    // 左上方向へ発射
    initialVx = speed * Math.cos((angle * Math.PI) / 180);
    initialVy = -speed * Math.sin((angle * Math.PI) / 180); // 負=上向き
  }

  // ボール種別をランダムに決定
  const type = getRandomBallType(difficulty);

  return {
    initialX,
    initialY,
    initialVx,
    initialVy,
    angle,
    speed,
    type,
  };
}

/**
 * 現在のボール位置と速度を計算
 * 重力と空気抵抗を考慮した物理演算
 */
export function updateBallPhysics(
  x: number,
  y: number,
  vx: number,
  vy: number,
  config: BallPhysicsConfig
): { x: number; y: number; vx: number; vy: number } {
  // 空気抵抗を適用
  const newVx = vx * (1 - config.airResistance);
  const newVy = vy * (1 - config.airResistance) + config.gravity;

  // 位置を更新
  const newX = x + newVx;
  const newY = y + newVy;

  return {
    x: newX,
    y: newY,
    vx: newVx,
    vy: newVy,
  };
}

/**
 * ボールが画面内にあるかチェック
 */
export function isBallInScreen(
  x: number,
  y: number,
  radius: number,
  screenWidth: number,
  screenHeight: number
): boolean {
  return (
    x + radius > 0 &&
    x - radius < screenWidth &&
    y + radius > 0 &&
    y - radius < screenHeight + 100 // 画面下部少し下まで許容
  );
}

/**
 * ボール速度から角度を計算
 */
export function getAngleFromVelocity(vx: number, vy: number): number {
  return Math.atan2(-vy, vx) * (180 / Math.PI);
}

/**
 * 角度と速度から速度ベクトルを計算
 */
export function getVelocityFromAngle(angle: number, speed: number): { vx: number; vy: number } {
  return {
    vx: speed * Math.cos((angle * Math.PI) / 180),
    vy: -speed * Math.sin((angle * Math.PI) / 180),
  };
}
