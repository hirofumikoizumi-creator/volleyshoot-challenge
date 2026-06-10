import { PoseData, Keypoint, PoseLandmark } from '@/lib/types/pose';

/**
 * Frame Processorで使用される骨格検知処理
 * MediaPipeのPose Detectionをラップ
 */

/**
 * ダミーの骨格データを生成（開発用）
 * 実装時にはMediaPipeの実際の検知結果に置き換える
 */
export function generateDummyPoseData(): PoseData {
  const landmarks: Keypoint[] = [];

  for (let i = 0; i < 33; i++) {
    landmarks.push({
      x: Math.random(),
      y: Math.random(),
      z: Math.random(),
      visibility: Math.random() > 0.3 ? Math.random() * 0.5 + 0.5 : 0.2,
      name: `landmark_${i}`,
    });
  }

  return {
    landmarks,
    visibility: 0.8,
  };
}

/**
 * 2点間の距離を計算
 */
export function calculateDistance(
  p1: Keypoint | null,
  p2: Keypoint | null
): number {
  if (!p1 || !p2) return Infinity;

  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * キーポイントが有効か確認
 */
export function isKeypointValid(
  keypoint: Keypoint | null,
  threshold: number = 0.5
): boolean {
  return keypoint !== null && (keypoint.visibility ?? 0) >= threshold;
}

/**
 * 画面座標に変換
 */
export function normalizeToScreenCoords(
  keypoint: Keypoint,
  screenWidth: number,
  screenHeight: number
): { x: number; y: number } {
  return {
    x: keypoint.x * screenWidth,
    y: keypoint.y * screenHeight,
  };
}

/**
 * 複数のキーポイント間の距離を計算
 */
export function calculateAverageDistance(
  keypoints: (Keypoint | null)[]
): number {
  const validKeypoints = keypoints.filter((kp) => isKeypointValid(kp));
  if (validKeypoints.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < validKeypoints.length - 1; i++) {
    totalDistance += calculateDistance(
      validKeypoints[i],
      validKeypoints[i + 1]
    );
  }

  return totalDistance / (validKeypoints.length - 1);
}

/**
 * キックの可能性を検知（足首の急速な動き）
 */
export function detectKickMotion(
  currentPose: PoseData,
  previousPose: PoseData | null,
  threshold: number = 0.15
): { isKick: boolean; leg: 'left' | 'right' | null } {
  if (!previousPose) {
    return { isKick: false, leg: null };
  }

  const leftAnkleCurrent =
    currentPose.landmarks[PoseLandmark.LEFT_ANKLE];
  const rightAnkleCurrent =
    currentPose.landmarks[PoseLandmark.RIGHT_ANKLE];
  const leftAnklePrevious =
    previousPose.landmarks[PoseLandmark.LEFT_ANKLE];
  const rightAnklePrevious =
    previousPose.landmarks[PoseLandmark.RIGHT_ANKLE];

  const leftAnkleDistance = calculateDistance(
    leftAnkleCurrent,
    leftAnklePrevious
  );
  const rightAnkleDistance = calculateDistance(
    rightAnkleCurrent,
    rightAnklePrevious
  );

  if (leftAnkleDistance > threshold) {
    return { isKick: true, leg: 'left' };
  }

  if (rightAnkleDistance > threshold) {
    return { isKick: true, leg: 'right' };
  }

  return { isKick: false, leg: null };
}

/**
 * 骨格データのスムージング（ノイズ低減）
 */
export function smoothPoseData(
  currentPose: PoseData,
  previousPose: PoseData | null,
  smoothingFactor: number = 0.7
): PoseData {
  if (!previousPose) return currentPose;

  const smoothedLandmarks = currentPose.landmarks.map((landmark, index) => {
    const prevLandmark = previousPose.landmarks[index];
    if (!prevLandmark) return landmark;

    return {
      ...landmark,
      x: landmark.x * (1 - smoothingFactor) + prevLandmark.x * smoothingFactor,
      y: landmark.y * (1 - smoothingFactor) + prevLandmark.y * smoothingFactor,
      z: (landmark.z ?? 0) * (1 - smoothingFactor) +
        (prevLandmark.z ?? 0) * smoothingFactor,
    };
  });

  return {
    ...currentPose,
    landmarks: smoothedLandmarks,
  };
}

/**
 * 下半身の姿勢を分析
 */
export function analyzeLowerBodyPosture(pose: PoseData): {
  isStanding: boolean;
  legSpread: number;
  balance: 'left' | 'right' | 'center';
} {
  const leftHip = pose.landmarks[PoseLandmark.LEFT_HIP];
  const rightHip = pose.landmarks[PoseLandmark.RIGHT_HIP];
  const leftAnkle = pose.landmarks[PoseLandmark.LEFT_ANKLE];
  const rightAnkle = pose.landmarks[PoseLandmark.RIGHT_ANKLE];

  const isStanding =
    isKeypointValid(leftHip) &&
    isKeypointValid(rightHip) &&
    isKeypointValid(leftAnkle) &&
    isKeypointValid(rightAnkle);

  const legSpread = Math.abs((leftAnkle?.x ?? 0) - (rightAnkle?.x ?? 0));

  let balance: 'left' | 'right' | 'center' = 'center';
  if (isStanding) {
    const centerX = ((leftHip?.x ?? 0) + (rightHip?.x ?? 0)) / 2;
    const anklesCenterX = ((leftAnkle?.x ?? 0) + (rightAnkle?.x ?? 0)) / 2;

    if (anklesCenterX < centerX - 0.05) {
      balance = 'left';
    } else if (anklesCenterX > centerX + 0.05) {
      balance = 'right';
    }
  }

  return {
    isStanding,
    legSpread,
    balance,
  };
}
