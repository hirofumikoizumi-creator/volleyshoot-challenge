/**
 * 骨格検知（Pose Detection）関連の型定義
 * MediaPipeのPose Detectionから取得されるキーポイント情報
 */

/**
 * キーポイント（関節）の座標と信頼度
 */
export interface Keypoint {
  x: number; // 画像内のX座標（0-1の正規化値）
  y: number; // 画像内のY座標（0-1の正規化値）
  z?: number; // 深度情報（オプション）
  visibility?: number; // 検知の信頼度（0-1）
  name?: string; // キーポイント名
}

/**
 * 骨格全体の情報
 */
export interface PoseData {
  landmarks: Keypoint[]; // すべてのキーポイント（33個）
  worldLandmarks?: Keypoint[]; // ワールド座標系のキーポイント
  visibility?: number; // 全体的な検知信頼度
}

/**
 * MediaPipeのキーポイントインデックス
 * 標準的な33個のキーポイント
 */
export enum PoseLandmark {
  // 頭部
  NOSE = 0,
  LEFT_EYE_INNER = 1,
  LEFT_EYE = 2,
  LEFT_EYE_OUTER = 3,
  RIGHT_EYE_INNER = 4,
  RIGHT_EYE = 5,
  RIGHT_EYE_OUTER = 6,
  LEFT_EAR = 7,
  RIGHT_EAR = 8,
  MOUTH_LEFT = 9,
  MOUTH_RIGHT = 10,

  // 肩
  LEFT_SHOULDER = 11,
  RIGHT_SHOULDER = 12,

  // 肘
  LEFT_ELBOW = 13,
  RIGHT_ELBOW = 14,

  // 手首
  LEFT_WRIST = 15,
  RIGHT_WRIST = 16,

  // 手指
  LEFT_PINKY = 17,
  RIGHT_PINKY = 18,
  LEFT_INDEX = 19,
  RIGHT_INDEX = 20,
  LEFT_THUMB = 21,
  RIGHT_THUMB = 22,

  // 股関節
  LEFT_HIP = 23,
  RIGHT_HIP = 24,

  // 膝
  LEFT_KNEE = 25,
  RIGHT_KNEE = 26,

  // 足首
  LEFT_ANKLE = 27,
  RIGHT_ANKLE = 28,

  // 足
  LEFT_HEEL = 29,
  RIGHT_HEEL = 30,
  LEFT_FOOT_INDEX = 31,
  RIGHT_FOOT_INDEX = 32,
}

/**
 * キック判定に必要な下半身キーポイント
 */
export interface LowerBodyKeypoints {
  leftHip: Keypoint | null;
  rightHip: Keypoint | null;
  leftKnee: Keypoint | null;
  rightKnee: Keypoint | null;
  leftAnkle: Keypoint | null;
  rightAnkle: Keypoint | null;
}

/**
 * フレーム処理の結果
 */
export interface FrameProcessorResult {
  pose: PoseData | null;
  timestamp: number;
  isProcessing: boolean;
}

/**
 * キック検知結果
 */
export interface KickDetectionResult {
  isKick: boolean;
  kickLeg: 'left' | 'right' | null;
  confidence: number;
  anklePosition: { x: number; y: number } | null;
}
