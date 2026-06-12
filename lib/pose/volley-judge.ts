import type { ScreenFootLandmarks } from "./blazepose-types";

export type VolleyBallEntity = {
  id: number;
  x: number;
  y: number;
  radius: number;
  targetTimeMs: number;
  state?: "flying" | "hit" | "missed";
};

export type VolleyJudgeConfig = {
  footRadiusRatio: number;
  minSwingSpeedBodyScalePerSecond: number;
  minStableFrames: number;
  minApproachDot: number;
  visibilityThreshold: number;
  earlyWindowMs: number;
  lateWindowMs: number;
  perfectWindowMs: number;
  goodWindowMs: number;
  okWindowMs: number;
};

export type VolleyJudgeResult = {
  hit: boolean;
  grade: "PERFECT" | "GOOD" | "OK" | "MISS";
  distance: number;
  timingErrorMs: number;
  normalizedSpeed: number;
  reason?: "visibility" | "stability" | "speed" | "distance" | "direction" | "timing";
};

export const DEFAULT_VOLLEY_JUDGE_CONFIG: VolleyJudgeConfig = {
  footRadiusRatio: 0.18,
  minSwingSpeedBodyScalePerSecond: 1.6,
  minStableFrames: 3,
  minApproachDot: 0.25,
  visibilityThreshold: 0.6,
  earlyWindowMs: -160,
  lateWindowMs: 160,
  perfectWindowMs: 50,
  goodWindowMs: 100,
  okWindowMs: 150,
};

function normalizeVector(vector: { x: number; y: number }) {
  const size = Math.hypot(vector.x, vector.y);
  if (size < 1e-6) return { x: 0, y: 0 };
  return { x: vector.x / size, y: vector.y / size };
}

function dot(a: { x: number; y: number }, b: { x: number; y: number }) {
  return a.x * b.x + a.y * b.y;
}

export function judgeVolleyHit(
  foot: ScreenFootLandmarks | undefined,
  ball: VolleyBallEntity,
  nowMs: number,
  bodyScale: number,
  config = DEFAULT_VOLLEY_JUDGE_CONFIG,
): VolleyJudgeResult {
  if (!foot?.contactPoint || foot.confidence < config.visibilityThreshold) {
    return { hit: false, grade: "MISS", distance: Infinity, timingErrorMs: Infinity, normalizedSpeed: 0, reason: "visibility" };
  }

  if (foot.stableFrames < config.minStableFrames) {
    return { hit: false, grade: "MISS", distance: Infinity, timingErrorMs: Infinity, normalizedSpeed: foot.normalizedSpeed, reason: "stability" };
  }

  const timingErrorMs = nowMs - ball.targetTimeMs;
  if (timingErrorMs < config.earlyWindowMs || timingErrorMs > config.lateWindowMs) {
    return { hit: false, grade: "MISS", distance: Infinity, timingErrorMs, normalizedSpeed: foot.normalizedSpeed, reason: "timing" };
  }

  if (foot.normalizedSpeed < config.minSwingSpeedBodyScalePerSecond) {
    return { hit: false, grade: "MISS", distance: Infinity, timingErrorMs, normalizedSpeed: foot.normalizedSpeed, reason: "speed" };
  }

  const footRadius = bodyScale * config.footRadiusRatio;
  const dx = foot.contactPoint.x - ball.x;
  const dy = foot.contactPoint.y - ball.y;
  const distance = Math.max(0, Math.sqrt(dx * dx + dy * dy) - ball.radius);
  if (distance > footRadius) {
    return { hit: false, grade: "MISS", distance, timingErrorMs, normalizedSpeed: foot.normalizedSpeed, reason: "distance" };
  }

  const centerDistance = Math.sqrt(dx * dx + dy * dy);
  const deepInside = centerDistance < ball.radius;
  const toBall = normalizeVector({ x: ball.x - foot.contactPoint.x, y: ball.y - foot.contactPoint.y });
  const moveDirection = normalizeVector(foot.velocity);
  if (!deepInside && dot(toBall, moveDirection) < config.minApproachDot) {
    return { hit: false, grade: "MISS", distance, timingErrorMs, normalizedSpeed: foot.normalizedSpeed, reason: "direction" };
  }

  const absTimingErrorMs = Math.abs(timingErrorMs);
  if (absTimingErrorMs > config.okWindowMs) {
    return { hit: false, grade: "MISS", distance, timingErrorMs, normalizedSpeed: foot.normalizedSpeed, reason: "timing" };
  }

  if (absTimingErrorMs <= config.perfectWindowMs) {
    return { hit: true, grade: "PERFECT", distance, timingErrorMs, normalizedSpeed: foot.normalizedSpeed };
  }

  if (absTimingErrorMs <= config.goodWindowMs) {
    return { hit: true, grade: "GOOD", distance, timingErrorMs, normalizedSpeed: foot.normalizedSpeed };
  }

  return { hit: true, grade: "OK", distance, timingErrorMs, normalizedSpeed: foot.normalizedSpeed };
}
