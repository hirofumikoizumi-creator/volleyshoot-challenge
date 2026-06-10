import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseData, PoseLandmark, LowerBodyKeypoints, Keypoint } from '@/lib/types/pose';

/**
 * 骨格検知フック
 * MediaPipeのPose Detectionを使用してリアルタイムで骨格を検知
 */
export function usePoseDetection() {
  const [poseData, setPoseData] = useState<PoseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const detectorRef = useRef<any>(null);

  /**
   * MediaPipeの初期化
   */
  useEffect(() => {
    const initializePoseDetector = async () => {
      try {
        // MediaPipeのPoseDetectorを初期化
        // 注：実装時にはMediaPipeのWasm初期化が必要
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize pose detector');
        setIsLoading(false);
      }
    };

    initializePoseDetector();

    return () => {
      // クリーンアップ
      if (detectorRef.current) {
        detectorRef.current = null;
      }
    };
  }, []);

  /**
   * フレームから骨格を検知
   * @param imageData 画像データ
   */
  const detectPose = useCallback(async (imageData: any) => {
    if (!detectorRef.current) return null;

    try {
      const results = await detectorRef.current.detectForVideo(imageData, Date.now());
      if (results && results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0].map((lm: any, idx: number) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
          visibility: lm.visibility,
          name: getPoseLandmarkName(idx),
        }));

        const pose: PoseData = {
          landmarks,
          worldLandmarks: results.worldLandmarks?.[0],
          visibility: results.landmarks[0][0]?.visibility,
        };

        setPoseData(pose);
        return pose;
      }
    } catch (err) {
      console.error('Pose detection error:', err);
    }

    return null;
  }, []);

  /**
   * キーポイント名を取得
   */
  const getPoseLandmarkName = (index: number): string => {
    const names: { [key: number]: string } = {
      [PoseLandmark.NOSE]: 'nose',
      [PoseLandmark.LEFT_SHOULDER]: 'left_shoulder',
      [PoseLandmark.RIGHT_SHOULDER]: 'right_shoulder',
      [PoseLandmark.LEFT_ELBOW]: 'left_elbow',
      [PoseLandmark.RIGHT_ELBOW]: 'right_elbow',
      [PoseLandmark.LEFT_WRIST]: 'left_wrist',
      [PoseLandmark.RIGHT_WRIST]: 'right_wrist',
      [PoseLandmark.LEFT_HIP]: 'left_hip',
      [PoseLandmark.RIGHT_HIP]: 'right_hip',
      [PoseLandmark.LEFT_KNEE]: 'left_knee',
      [PoseLandmark.RIGHT_KNEE]: 'right_knee',
      [PoseLandmark.LEFT_ANKLE]: 'left_ankle',
      [PoseLandmark.RIGHT_ANKLE]: 'right_ankle',
    };
    return names[index] || `landmark_${index}`;
  };

  /**
   * 下半身のキーポイントを抽出
   */
  const getLowerBodyKeypoints = useCallback((): LowerBodyKeypoints => {
    if (!poseData) {
      return {
        leftHip: null,
        rightHip: null,
        leftKnee: null,
        rightKnee: null,
        leftAnkle: null,
        rightAnkle: null,
      };
    }

    return {
      leftHip: poseData.landmarks[PoseLandmark.LEFT_HIP] || null,
      rightHip: poseData.landmarks[PoseLandmark.RIGHT_HIP] || null,
      leftKnee: poseData.landmarks[PoseLandmark.LEFT_KNEE] || null,
      rightKnee: poseData.landmarks[PoseLandmark.RIGHT_KNEE] || null,
      leftAnkle: poseData.landmarks[PoseLandmark.LEFT_ANKLE] || null,
      rightAnkle: poseData.landmarks[PoseLandmark.RIGHT_ANKLE] || null,
    };
  }, [poseData]);

  /**
   * キーポイントの信頼度をチェック
   */
  const isKeypointVisible = useCallback(
    (keypoint: Keypoint | null, threshold: number = 0.5): boolean => {
      return keypoint !== null && (keypoint.visibility ?? 0) >= threshold;
    },
    []
  );

  return {
    poseData,
    isLoading,
    error,
    detectPose,
    getLowerBodyKeypoints,
    isKeypointVisible,
  };
}
