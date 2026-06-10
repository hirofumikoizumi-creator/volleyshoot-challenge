/**
 * ボール関連の型定義
 * アニメーション、衝突判定、エフェクト処理に使用
 */

/**
 * ボールの位置と状態
 */
export interface BallState {
  id: string; // ボールの一意識別子
  x: number; // X座標（画面座標）
  y: number; // Y座標（画面座標）
  vx: number; // X方向の速度
  vy: number; // Y方向の速度
  radius: number; // ボールの半径（ピクセル）
  isActive: boolean; // アクティブ状態
  createdAt: number; // 生成時刻
}

/**
 * ボールアニメーション設定
 */
export interface BallAnimationConfig {
  initialX: number; // 初期X座標
  initialY: number; // 初期Y座標
  targetX: number; // ターゲットX座標
  targetY: number; // ターゲットY座標
  duration: number; // アニメーション時間（ミリ秒）
  gravity: number; // 重力加速度
  initialVelocity: number; // 初期速度
}

/**
 * 衝突判定結果
 */
export interface CollisionResult {
  hasCollision: boolean; // 衝突したか
  ballId: string | null; // 衝突したボールID
  collisionPoint: { x: number; y: number } | null; // 衝突地点
  collisionForce: number; // 衝突の強さ（0-1）
}

/**
 * キック成功エフェクト
 */
export interface KickEffect {
  id: string; // エフェクトID
  x: number; // X座標
  y: number; // Y座標
  vx: number; // X方向の速度
  vy: number; // Y方向の速度
  lifetime: number; // エフェクトの寿命（ミリ秒）
  createdAt: number; // 生成時刻
  type: 'particle' | 'glow' | 'trail'; // エフェクトタイプ
}

/**
 * ゲームスコア情報
 */
export interface GameScore {
  totalScore: number; // 総スコア
  comboCount: number; // コンボ数
  lastKickTime: number; // 最後のキック時刻
  kickCount: number; // キック回数
  accuracyPercentage: number; // 精度（パーセンテージ）
}

/**
 * ゲーム統計情報
 */
export interface GameStats {
  totalKicks: number; // 総キック数
  successfulKicks: number; // 成功したキック数
  missedKicks: number; // ミスしたキック数
  averageAccuracy: number; // 平均精度
  maxCombo: number; // 最大コンボ数
  playTime: number; // プレイ時間（秒）
}

/**
 * 難易度設定
 */
export enum GameDifficulty {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
}

/**
 * 難易度別パラメータ
 */
export interface DifficultyParams {
  ballSpeed: number; // ボール速度（倍数）
  spawnInterval: number; // ボール生成間隔（ミリ秒）
  targetRadius: number; // キック判定半径（ピクセル）
  gravity: number; // 重力加速度
}

/**
 * 難易度別設定マップ
 */
export const DIFFICULTY_PARAMS: Record<GameDifficulty, DifficultyParams> = {
  [GameDifficulty.EASY]: {
    ballSpeed: 1.0,
    spawnInterval: 1500,
    targetRadius: 80,
    gravity: 0.3,
  },
  [GameDifficulty.NORMAL]: {
    ballSpeed: 1.5,
    spawnInterval: 1000,
    targetRadius: 60,
    gravity: 0.5,
  },
  [GameDifficulty.HARD]: {
    ballSpeed: 2.0,
    spawnInterval: 600,
    targetRadius: 40,
    gravity: 0.7,
  },
};
