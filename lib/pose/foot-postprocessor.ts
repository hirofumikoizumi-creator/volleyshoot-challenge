import { isVisible, type LowerBodyLandmarks, type PoseSide, type ScreenFootLandmarks, type ScreenPoint } from "./blazepose-types";
import { modelToCoverViewPoint, type CoverTransformOptions } from "./coordinate-transform";
import { OneEuroPointFilter } from "./one-euro-filter";

type FootHistorySample = {
  point: ScreenPoint;
  timestampMs: number;
};

const VELOCITY_WINDOW_MS = 130;
const MIN_SAMPLES_FOR_VELOCITY = 3;
const MAX_PLAUSIBLE_SPEED = 12;
const MAX_EXTRAPOLATION_MS = 140;

function distance(a: ScreenPoint, b: ScreenPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mixPoint(a: ScreenPoint, b: ScreenPoint, amount: number): ScreenPoint {
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
    visibility: Math.min(a.visibility, b.visibility),
  };
}

function fitVelocityLeastSquares(samples: FootHistorySample[]) {
  if (samples.length < MIN_SAMPLES_FOR_VELOCITY) {
    return { x: 0, y: 0, speed: 0 };
  }

  const t0 = samples[0].timestampMs;
  let sumT = 0;
  let sumTT = 0;
  let sumX = 0;
  let sumY = 0;
  let sumTX = 0;
  let sumTY = 0;

  for (const sample of samples) {
    const t = sample.timestampMs - t0;
    sumT += t;
    sumTT += t * t;
    sumX += sample.point.x;
    sumY += sample.point.y;
    sumTX += t * sample.point.x;
    sumTY += t * sample.point.y;
  }

  const n = samples.length;
  const denom = n * sumTT - sumT * sumT;
  if (Math.abs(denom) < 1e-6) {
    return { x: 0, y: 0, speed: 0 };
  }

  const x = (n * sumTX - sumT * sumX) / denom;
  const y = (n * sumTY - sumT * sumY) / denom;
  return { x, y, speed: Math.hypot(x, y) };
}

export class FootPostProcessor {
  private filters: Record<PoseSide, Record<"ankle" | "heel" | "footIndex", OneEuroPointFilter>> = {
    left: {
      ankle: new OneEuroPointFilter(),
      heel: new OneEuroPointFilter(),
      footIndex: new OneEuroPointFilter(),
    },
    right: {
      ankle: new OneEuroPointFilter(),
      heel: new OneEuroPointFilter(),
      footIndex: new OneEuroPointFilter(),
    },
  };

  private history: Record<PoseSide, FootHistorySample[]> = {
    left: [],
    right: [],
  };

  private stableFrames: Record<PoseSide, number> = {
    left: 0,
    right: 0,
  };

  toScreenFoot(
    side: PoseSide,
    lowerBody: LowerBodyLandmarks,
    transform: CoverTransformOptions,
    timestampMs: number,
    latencyMs: number,
    bodyScale: number,
  ): ScreenFootLandmarks | undefined {
    const prefix = side === "left" ? "left" : "right";
    const ankleRaw = lowerBody[`${prefix}_ankle`];
    const heelRaw = lowerBody[`${prefix}_heel`];
    const footIndexRaw = lowerBody[`${prefix}_foot_index`];

    if (!isVisible(footIndexRaw) || !isVisible(ankleRaw) || !isVisible(heelRaw)) {
      this.stableFrames[side] = 0;
      this.history[side] = [];
      return undefined;
    }

    const ankle = this.filters[side].ankle.filter(modelToCoverViewPoint(ankleRaw, transform), timestampMs);
    const heel = heelRaw && isVisible(heelRaw) ? this.filters[side].heel.filter(modelToCoverViewPoint(heelRaw, transform), timestampMs) : undefined;
    const footIndex = this.filters[side].footIndex.filter(modelToCoverViewPoint(footIndexRaw, transform), timestampMs);
    const contactPoint = mixPoint(ankle, footIndex, 0.65);
    const predictedContactPoint = this.predictLatency(side, contactPoint, timestampMs, latencyMs);
    const previous = this.history[side][this.history[side].length - 1];

    if (previous) {
      const elapsedSeconds = Math.max(1e-3, (timestampMs - previous.timestampMs) / 1000);
      const instantNormalizedSpeed = distance(predictedContactPoint, previous.point) / elapsedSeconds / Math.max(1, bodyScale);
      if (instantNormalizedSpeed > MAX_PLAUSIBLE_SPEED) {
        return undefined;
      }
    }

    const velocity = this.velocity(side, predictedContactPoint, timestampMs);
    const normalizedSpeed = (velocity.speed * 1000) / Math.max(1, bodyScale);
    const confidence = Math.min(ankle.visibility, footIndex.visibility, heel?.visibility ?? 1);
    this.stableFrames[side] += 1;

    return {
      side,
      ankle,
      heel,
      footIndex,
      contactPoint: predictedContactPoint,
      velocity,
      normalizedSpeed,
      confidence,
      stableFrames: this.stableFrames[side],
      timestampMs,
    };
  }

  private velocity(side: PoseSide, point: ScreenPoint, timestampMs: number) {
    const samples = this.history[side];
    samples.push({ point, timestampMs });
    while (samples.length > 0 && samples[0].timestampMs < timestampMs - VELOCITY_WINDOW_MS) {
      samples.shift();
    }

    return fitVelocityLeastSquares(samples);
  }

  private predictLatency(side: PoseSide, point: ScreenPoint, timestampMs: number, latencyMs: number): ScreenPoint {
    const samples = this.history[side];
    const previous = samples[samples.length - 1];
    if (!previous) return point;

    const elapsed = Math.max(16, timestampMs - previous.timestampMs);
    const vx = (point.x - previous.point.x) / elapsed;
    const vy = (point.y - previous.point.y) / elapsed;
    const lookaheadMs = Math.min(MAX_EXTRAPOLATION_MS, Math.max(0, latencyMs + 16));

    return {
      ...point,
      x: point.x + vx * lookaheadMs,
      y: point.y + vy * lookaheadMs,
    };
  }
}
