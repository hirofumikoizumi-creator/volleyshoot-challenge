/**
 * Core Volley Shoot Challenge rules.
 *
 * The numbers mirror docs/volleyshoot-game.html, with hit radius widened for
 * MoveNet ankle-only contact points.
 */

export type GameDifficulty = "EASY" | "NORMAL" | "HARD" | "TRAINING";
export type PlayDifficulty = Exclude<GameDifficulty, "TRAINING">;
export type BallType = "NORMAL" | "BLUE" | "GOLD" | "BLACK";
export type BallKind = "SIDE" | "FRONT";

export type DifficultyConfig = {
  timeLimit: number;
  spawnInterval: number;
  ballSpawnInterval: number;
  speedMin: number;
  speedMax: number;
  initialSpeed: { min: number; max: number };
  gravity: number;
  airResistance: number;
  hitRadius: number;
  blueRate: number;
  goldRate: number;
  blackRate: number;
  multiplier: number;
  ballScale: number;
  frontRate: number;
  ballTypeDistribution: {
    normal: number;
    blue: number;
    gold: number;
  };
  color: string;
  emoji: string;
};

export type BallTypeConfig = {
  points: number;
  color: string;
  rarity: number;
};

export type FootPoint = {
  x: number;
  y: number;
  speed: number;
  side: "L" | "R";
  confidence?: number;
};

export type VolleyBall = {
  id: string;
  kind: BallKind;
  type: BallType;
  x: number;
  y: number;
  radius: number;
  active: boolean;
  kicked: boolean;
  createdAtMs: number;
  vx?: number;
  vy?: number;
  startX?: number;
  startY?: number;
  targetX?: number;
  targetY?: number;
  p?: number;
  flightTime?: number;
  fullRadius?: number;
  kickWindowOpenedAtMs?: number;
};

export const KICK_MIN_SPEED = 320;
export const PERFECT_FOOT_SPEED = 900;
export const FRONT_KICK_MIN_P = 0.76;
export const FRONT_KICK_MAX_P = 1.1;
export const COMBO_TIMEOUT_MS = 2600;
export const MOVENET_CONFIDENCE_THRESHOLD = 0.4;

const HIT_RADIUS_SCALE_FOR_ANKLE_ONLY = 1.2;

export const DIFFICULTY_CONFIG: Record<GameDifficulty, DifficultyConfig> = {
  EASY: {
    timeLimit: 60,
    spawnInterval: 2300,
    ballSpawnInterval: 2300,
    speedMin: 0.42,
    speedMax: 0.58,
    initialSpeed: { min: 0.42, max: 0.58 },
    gravity: 0.62,
    airResistance: 0.02,
    hitRadius: 78 * HIT_RADIUS_SCALE_FOR_ANKLE_ONLY,
    blueRate: 0,
    goldRate: 0.08,
    blackRate: 0.06,
    multiplier: 1,
    ballScale: 1.25,
    frontRate: 0.35,
    ballTypeDistribution: { normal: 86, blue: 0, gold: 8 },
    color: "#4ADE80",
    emoji: "E",
  },
  NORMAL: {
    timeLimit: 60,
    spawnInterval: 1750,
    ballSpawnInterval: 1750,
    speedMin: 0.52,
    speedMax: 0.72,
    initialSpeed: { min: 0.52, max: 0.72 },
    gravity: 0.72,
    airResistance: 0.018,
    hitRadius: 62 * HIT_RADIUS_SCALE_FOR_ANKLE_ONLY,
    blueRate: 0.12,
    goldRate: 0.08,
    blackRate: 0.12,
    multiplier: 1.5,
    ballScale: 1,
    frontRate: 0.45,
    ballTypeDistribution: { normal: 68, blue: 12, gold: 8 },
    color: "#60A5FA",
    emoji: "N",
  },
  HARD: {
    timeLimit: 45,
    spawnInterval: 1300,
    ballSpawnInterval: 1300,
    speedMin: 0.62,
    speedMax: 0.88,
    initialSpeed: { min: 0.62, max: 0.88 },
    gravity: 0.82,
    airResistance: 0.015,
    hitRadius: 50 * HIT_RADIUS_SCALE_FOR_ANKLE_ONLY,
    blueRate: 0.2,
    goldRate: 0.1,
    blackRate: 0.16,
    multiplier: 2,
    ballScale: 0.8,
    frontRate: 0.5,
    ballTypeDistribution: { normal: 54, blue: 20, gold: 10 },
    color: "#F87171",
    emoji: "H",
  },
  TRAINING: {
    timeLimit: 0,
    spawnInterval: 1500,
    ballSpawnInterval: 1500,
    speedMin: 0.42,
    speedMax: 0.72,
    initialSpeed: { min: 0.42, max: 0.72 },
    gravity: 0.62,
    airResistance: 0.02,
    hitRadius: 78 * HIT_RADIUS_SCALE_FOR_ANKLE_ONLY,
    blueRate: 0,
    goldRate: 0,
    blackRate: 0,
    multiplier: 1,
    ballScale: 1.1,
    frontRate: 0.5,
    ballTypeDistribution: { normal: 100, blue: 0, gold: 0 },
    color: "#A78BFA",
    emoji: "T",
  },
};

export const BALL_TYPE_CONFIG: Record<BallType, BallTypeConfig> = {
  NORMAL: { points: 10, color: "#F5F8FF", rarity: 1 },
  BLUE: { points: 20, color: "#3B9CFF", rarity: 4 },
  GOLD: { points: 30, color: "#FFC53D", rarity: 8 },
  BLACK: { points: -20, color: "#1A1A22", rarity: 6 },
};

export function asPlayDifficulty(difficulty: GameDifficulty | undefined): PlayDifficulty {
  return difficulty === "EASY" || difficulty === "HARD" ? difficulty : "NORMAL";
}

export function pickBallType(config: DifficultyConfig): BallType {
  const roll = Math.random();
  if (roll < config.blackRate) return "BLACK";
  if (roll < config.blackRate + config.goldRate) return "GOLD";
  if (roll < config.blackRate + config.goldRate + config.blueRate) return "BLUE";
  return "NORMAL";
}

export function generateSideBall(
  id: string,
  screenW: number,
  screenH: number,
  difficulty: PlayDifficulty,
  nowMs: number,
): VolleyBall {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const fromLeft = Math.random() > 0.5;
  const type = pickBallType(cfg);
  const speedFactor = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
  const typeSpeed = type === "BLUE" ? 1.25 : 1;

  const startX = fromLeft ? -40 : screenW + 40;
  const startY = screenH * (0.78 + Math.random() * 0.18);
  const targetX = screenW * (0.3 + Math.random() * 0.4);
  const apexY = screenH * (0.28 + Math.random() * 0.25);

  const flightTime = (1.9 - speedFactor) / typeSpeed;
  const g = cfg.gravity * 1600;
  const vy0 = -Math.sqrt(2 * g * Math.max(60, startY - apexY));
  const vx0 = (targetX - startX) / flightTime;
  const radius = 26 * cfg.ballScale;

  return {
    id,
    kind: "SIDE",
    type,
    x: startX,
    y: startY,
    vx: vx0,
    vy: vy0,
    radius,
    active: true,
    kicked: false,
    createdAtMs: nowMs,
  };
}

export function generateFrontBall(
  id: string,
  screenW: number,
  screenH: number,
  difficulty: PlayDifficulty,
  nowMs: number,
  footX?: number,
  footY?: number,
): VolleyBall {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const type = pickBallType(cfg);
  const fullRadius = 26 * cfg.ballScale;

  let targetX = screenW * (0.3 + Math.random() * 0.4);
  let targetY = screenH * (0.7 + Math.random() * 0.15);
  if (footX !== undefined && footY !== undefined) {
    if (type === "BLACK") {
      const dir = Math.random() > 0.5 ? 1 : -1;
      targetX = Math.max(screenW * 0.08, Math.min(screenW * 0.92, footX + dir * 170));
      targetY = Math.max(screenH * 0.4, Math.min(screenH * 0.95, footY));
    } else {
      targetX = Math.max(screenW * 0.15, Math.min(screenW * 0.85, footX + (Math.random() - 0.5) * 180));
      targetY = Math.max(screenH * 0.4, Math.min(screenH * 0.95, footY));
    }
  }

  const startX = screenW * (0.35 + Math.random() * 0.3);
  const startY = screenH * (0.2 + Math.random() * 0.12);

  return {
    id,
    kind: "FRONT",
    type,
    fullRadius,
    radius: fullRadius * 0.28,
    x: startX,
    y: startY,
    startX,
    startY,
    targetX,
    targetY,
    p: 0,
    flightTime: type === "BLUE" ? 1.68 : 2.1,
    active: true,
    kicked: false,
    createdAtMs: nowMs,
  };
}

export function generateBall(
  id: string,
  screenW: number,
  screenH: number,
  difficulty: PlayDifficulty,
  nowMs: number,
  foot?: Pick<FootPoint, "x" | "y">,
): VolleyBall {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  if (Math.random() < cfg.frontRate) {
    return generateFrontBall(id, screenW, screenH, difficulty, nowMs, foot?.x, foot?.y);
  }
  return generateSideBall(id, screenW, screenH, difficulty, nowMs);
}

export function updateBall(ball: VolleyBall, dtSeconds: number, difficulty: PlayDifficulty): VolleyBall {
  if (!ball.active) return ball;
  const cfg = DIFFICULTY_CONFIG[difficulty];

  if (ball.kind === "FRONT") {
    const flightTime = ball.flightTime ?? 2.1;
    const nextP = (ball.p ?? 0) + dtSeconds / flightTime;
    const ease = 1 - Math.pow(1 - Math.min(nextP, 1.18), 2);
    const startX = ball.startX ?? ball.x;
    const startY = ball.startY ?? ball.y;
    const targetX = ball.targetX ?? ball.x;
    const targetY = ball.targetY ?? ball.y;
    const wobble = Math.sin(nextP * Math.PI) * 36;
    return {
      ...ball,
      p: nextP,
      x: startX + (targetX - startX) * ease + wobble * (nextP < 1 ? 1 : 0),
      y: startY + (targetY - startY) * ease,
      radius: (ball.fullRadius ?? ball.radius) * (0.28 + Math.min(nextP, 1.08) * 0.72),
      kickWindowOpenedAtMs:
        ball.kickWindowOpenedAtMs ?? (nextP >= FRONT_KICK_MIN_P ? Date.now() : undefined),
    };
  }

  const vx = ball.vx ?? 0;
  const vy = ball.vy ?? 0;
  const nextVy = vy + cfg.gravity * 1600 * dtSeconds;
  return {
    ...ball,
    x: ball.x + vx * dtSeconds,
    y: ball.y + nextVy * dtSeconds,
    vx,
    vy: nextVy,
  };
}

export function isBallExpired(ball: VolleyBall, screenW: number, screenH: number): boolean {
  if (!ball.active) return true;
  if (ball.kind === "FRONT") return (ball.p ?? 0) > 1.18;
  return (
    ball.x + ball.radius < -100 ||
    ball.x - ball.radius > screenW + 100 ||
    ball.y - ball.radius > screenH + 120
  );
}

export type KickResult = "kick" | "touch" | "black_safe" | "black_kick" | "miss";

export function checkKick(ball: VolleyBall, foot: FootPoint, hitRadius: number): KickResult {
  if (ball.kicked || !ball.active) return "miss";
  if (ball.kind === "FRONT" && ((ball.p ?? 0) < FRONT_KICK_MIN_P || (ball.p ?? 0) > FRONT_KICK_MAX_P)) {
    return "miss";
  }

  const radiusMul = ball.type === "BLACK" ? 0.6 : 1;
  const dist = Math.hypot(foot.x - ball.x, foot.y - ball.y);
  const threshold = hitRadius * radiusMul + ball.radius;
  if (dist > threshold) return "miss";

  const swinging = foot.speed >= KICK_MIN_SPEED;
  if (ball.type === "BLACK") return swinging ? "black_kick" : "black_safe";
  return swinging ? "kick" : "touch";
}

export function calcScore(
  ballType: BallType,
  footSpeed: number,
  combo: number,
  difficulty: PlayDifficulty,
): { points: number; perfect: boolean } {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const base = Math.abs(BALL_TYPE_CONFIG[ballType].points);
  const perfect = footSpeed >= PERFECT_FOOT_SPEED;
  const comboBonus = combo * 5;
  const points = Math.round(base * cfg.multiplier * (perfect ? 1.5 : 1) + comboBonus);
  return { points, perfect };
}

export function calcBlackPenalty(difficulty: PlayDifficulty): number {
  return Math.round(Math.abs(BALL_TYPE_CONFIG.BLACK.points) * DIFFICULTY_CONFIG[difficulty].multiplier);
}

export function calcNiceThroughBonus(difficulty: PlayDifficulty): number {
  return Math.round(5 * DIFFICULTY_CONFIG[difficulty].multiplier);
}

export function getRankFromStats(stats: {
  successCount: number;
  totalBalls: number;
  penaltyCount: number;
  perfectCount: number;
}): { rank: string; color: string; label: string } {
  const successRate = stats.totalBalls > 0 ? stats.successCount / stats.totalBalls : 0;
  const perfectRate = stats.successCount > 0 ? stats.perfectCount / stats.successCount : 0;
  if (successRate >= 0.85 && stats.penaltyCount === 0 && perfectRate >= 0.3) {
    return { rank: "S", color: "#FFC53D", label: "ノーミスの名手" };
  }
  if (successRate >= 0.78) return { rank: "A", color: "#3B9CFF", label: "安定したキック" };
  if (successRate >= 0.62) return { rank: "B", color: "#4ADE80", label: "いい反応" };
  return { rank: "C", color: "#CBD5E1", label: "次はもっといける" };
}

export function getRankFromSuccessRate(successRate: number): {
  rank: string;
  color: string;
  emoji: string;
} {
  if (successRate >= 0.9) return { rank: "S", color: "#FFC53D", emoji: "S" };
  if (successRate >= 0.8) return { rank: "A", color: "#3B9CFF", emoji: "A" };
  if (successRate >= 0.7) return { rank: "B", color: "#4ADE80", emoji: "B" };
  if (successRate >= 0.6) return { rank: "C", color: "#F59E0B", emoji: "C" };
  return { rank: "D", color: "#CBD5E1", emoji: "D" };
}

export function getRandomBallType(difficulty: GameDifficulty): BallType {
  return pickBallType(DIFFICULTY_CONFIG[difficulty]);
}
