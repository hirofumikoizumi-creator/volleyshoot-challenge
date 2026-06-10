/**
 * ゲーム設定と難易度パラメータ
 */

export type GameDifficulty = 'EASY' | 'NORMAL' | 'HARD' | 'TRAINING';
export type BallType = 'NORMAL' | 'BLUE' | 'GOLD';

export interface DifficultyConfig {
  gravity: number; // 重力加速度
  airResistance: number; // 空気抵抗
  ballSpawnInterval: number; // ボール生成間隔（ミリ秒）
  initialSpeed: { min: number; max: number }; // 初速度範囲
  timeLimit: number; // ゲーム時間（秒）
  ballTypeDistribution: {
    normal: number; // 通常ボール出現率（%）
    blue: number; // 青ボール出現率（%）
    gold: number; // 黄金ボール出現率（%）
  };
  color?: string; // UI表示色
  emoji?: string; // 難易度絵文字
}

export interface BallTypeConfig {
  points: number; // スコア
  color: string; // 表示色
  rarity: number; // レア度（1-10）
}

// 難易度設定
export const DIFFICULTY_CONFIG: Record<GameDifficulty, DifficultyConfig> = {
  EASY: {
    gravity: 0.15,
    airResistance: 0.03,
    ballSpawnInterval: 3000, // 3秒ごと
    initialSpeed: { min: 4, max: 6 },
    timeLimit: 60,
    ballTypeDistribution: {
      normal: 90,
      blue: 5,
      gold: 5,
    },
    color: '#4ADE80',
    emoji: '👕',
  },
  NORMAL: {
    gravity: 0.25,
    airResistance: 0.02,
    ballSpawnInterval: 2000, // 2秒ごと
    initialSpeed: { min: 5, max: 7 },
    timeLimit: 60,
    ballTypeDistribution: {
      normal: 80,
      blue: 10,
      gold: 10,
    },
    color: '#60A5FA',
    emoji: '⚽',
  },
  HARD: {
    gravity: 0.35,
    airResistance: 0.01,
    ballSpawnInterval: 1500, // 1.5秒ごと
    initialSpeed: { min: 6, max: 8 },
    timeLimit: 60,
    ballTypeDistribution: {
      normal: 70,
      blue: 15,
      gold: 15,
    },
    color: '#F87171',
    emoji: '🔥',
  },
  TRAINING: {
    gravity: 0.25,
    airResistance: 0.02,
    ballSpawnInterval: 1500, // 1.5秒ごと
    initialSpeed: { min: 4, max: 8 },
    timeLimit: 0, // 無制限
    ballTypeDistribution: {
      normal: 100,
      blue: 0,
      gold: 0,
    },
    color: '#A78BFA',
    emoji: '🎓',
  },
};

// ボール種別設定
export const BALL_TYPE_CONFIG: Record<BallType, BallTypeConfig> = {
  NORMAL: {
    points: 10,
    color: '#FFFFFF',
    rarity: 1,
  },
  BLUE: {
    points: -30,
    color: '#0099FF',
    rarity: 5,
  },
  GOLD: {
    points: 50,
    color: '#FFD700',
    rarity: 10,
  },
};

/**
 * ランク判定（成功率ベース）
 */
export function getRankFromSuccessRate(successRate: number): {
  rank: string;
  color: string;
  emoji: string;
} {
  if (successRate >= 0.9) {
    return { rank: 'S', color: '#FFD700', emoji: '🏆' };
  } else if (successRate >= 0.8) {
    return { rank: 'A', color: '#FF6B6B', emoji: '⭐' };
  } else if (successRate >= 0.7) {
    return { rank: 'B', color: '#00D9FF', emoji: '👍' };
  } else if (successRate >= 0.6) {
    return { rank: 'C', color: '#90EE90', emoji: '✌️' };
  } else {
    return { rank: 'D', color: '#CCCCCC', emoji: '💪' };
  }
}

/**
 * ランダムなボール種別を生成
 */
export function getRandomBallType(difficulty: GameDifficulty): BallType {
  // トレーニングモードは常に通常ボール
  if (difficulty === 'TRAINING') {
    return 'NORMAL';
  }

  const distribution = DIFFICULTY_CONFIG[difficulty].ballTypeDistribution;
  const rand = Math.random() * 100;

  if (rand < distribution.normal) {
    return 'NORMAL';
  } else if (rand < distribution.normal + distribution.blue) {
    return 'BLUE';
  } else {
    return 'GOLD';
  }
}
