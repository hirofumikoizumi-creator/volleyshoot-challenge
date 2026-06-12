export type PoseSide = "left" | "right";

export type LowerBodyLandmarkName =
  | "left_hip"
  | "right_hip"
  | "left_knee"
  | "right_knee"
  | "left_ankle"
  | "right_ankle"
  | "left_heel"
  | "right_heel"
  | "left_foot_index"
  | "right_foot_index";

export type LandmarkPoint = {
  name: LowerBodyLandmarkName;
  x: number;
  y: number;
  z?: number;
  visibility: number;
};

export type LowerBodyLandmarks = Partial<Record<LowerBodyLandmarkName, LandmarkPoint>>;

export type ScreenPoint = {
  x: number;
  y: number;
  visibility: number;
};

export type ScreenFootLandmarks = {
  side: PoseSide;
  ankle?: ScreenPoint;
  heel?: ScreenPoint;
  footIndex?: ScreenPoint;
  contactPoint?: ScreenPoint;
  velocity: { x: number; y: number; speed: number };
  normalizedSpeed: number;
  confidence: number;
  stableFrames: number;
  timestampMs: number;
};

export type PoseFrame = {
  lowerBody: LowerBodyLandmarks;
  leftFoot?: ScreenFootLandmarks;
  rightFoot?: ScreenFootLandmarks;
  latencyMs: number;
  timestampMs: number;
};

export const BLAZEPOSE_LANDMARK_INDEX: Record<LowerBodyLandmarkName, number> = {
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28,
  left_heel: 29,
  right_heel: 30,
  left_foot_index: 31,
  right_foot_index: 32,
};

export const LOWER_BODY_NAMES = Object.keys(BLAZEPOSE_LANDMARK_INDEX) as LowerBodyLandmarkName[];

export function extractLowerBodyLandmarks(
  rawLandmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>,
): LowerBodyLandmarks {
  return LOWER_BODY_NAMES.reduce<LowerBodyLandmarks>((result, name) => {
    const raw = rawLandmarks[BLAZEPOSE_LANDMARK_INDEX[name]];
    if (!raw) return result;

    result[name] = {
      name,
      x: raw.x,
      y: raw.y,
      z: raw.z,
      visibility: raw.visibility ?? 0,
    };
    return result;
  }, {});
}

export function isVisible(
  point: LandmarkPoint | ScreenPoint | undefined,
  threshold = 0.6,
): point is LandmarkPoint | ScreenPoint {
  return Boolean(point && point.visibility >= threshold);
}
