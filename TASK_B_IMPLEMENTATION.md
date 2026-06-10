# タスクB：カメラと骨格検知の実装ガイド

このドキュメントは、「ボレーシュートチャレンジ」アプリのカメラ機能と骨格検知（Pose Detection）の実装方法を説明します。

---

## 1. 実装済みコンポーネント概要

### 1.1 型定義 (`lib/types/pose.ts`)

骨格検知に必要な型定義を提供します：

| 型 | 説明 |
|---|---|
| `Keypoint` | キーポイント（関節）の座標と信頼度 |
| `PoseData` | 骨格全体の情報（33個のキーポイント） |
| `PoseLandmark` | MediaPipeの標準キーポイントインデックス |
| `LowerBodyKeypoints` | キック判定用の下半身キーポイント |

**主要なキーポイントインデックス：**

```typescript
LEFT_HIP = 23,        // 左股関節
RIGHT_HIP = 24,       // 右股関節
LEFT_KNEE = 25,       // 左膝
RIGHT_KNEE = 26,      // 右膝
LEFT_ANKLE = 27,      // 左足首
RIGHT_ANKLE = 28,     // 右足首
```

### 1.2 ゲームカメラコンポーネント (`components/game-camera.tsx`)

リアカメラを全画面表示し、骨格検知結果をオーバーレイ描画するコンポーネント：

**主要な機能：**

- リアカメラの全画面表示
- カメラパーミッションの確認と要求
- 骨格キーポイントのSkia描画（実装予定）

**使用方法：**

```typescript
import { GameCamera } from '@/components/game-camera';

<GameCamera 
  poseData={poseData}
  showKeypoints={true}
  onPoseDetected={(pose) => {
    // 骨格検知結果を処理
  }}
/>
```

### 1.3 骨格検知フック (`hooks/use-pose-detection.ts`)

MediaPipeのPose Detectionを使用したカスタムフック：

**提供される機能：**

- `detectPose()`: フレームから骨格を検知
- `getLowerBodyKeypoints()`: 下半身のキーポイントを抽出
- `isKeypointVisible()`: キーポイントの信頼度をチェック

### 1.4 骨格処理ユーティリティ (`lib/pose-processor.ts`)

Frame Processorで使用される骨格検知処理：

| 関数 | 説明 |
|---|---|
| `calculateDistance()` | 2点間の距離を計算 |
| `isKeypointValid()` | キーポイントが有効か確認 |
| `normalizeToScreenCoords()` | 画面座標に変換 |
| `detectKickMotion()` | キックの可能性を検知 |
| `smoothPoseData()` | 骨格データのスムージング |
| `analyzeLowerBodyPosture()` | 下半身の姿勢を分析 |

### 1.5 ゲーム画面 (`app/(tabs)/game.tsx`)

メインのゲーム画面実装：

**主要な要素：**

- カメラビューの表示
- スコア表示（左上）
- タイマー表示（右上）
- 一時停止ボタン（右下）
- ゲーム終了画面

---

## 2. Frame Processor の実装

Frame Processorは、カメラフレームをリアルタイムで処理し、骨格検知を実行します。

### 2.1 Frame Processorの基本構造

```typescript
import { useFrameProcessor } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';

const frameProcessor = useFrameProcessor((frame) => {
  'worklet';
  
  // ネイティブスレッドで実行される処理
  // MediaPipeの骨格検知をここで実行
  
  // JS側で実行する処理
  runOnJS(updatePoseData)(detectedPose);
}, []);
```

### 2.2 MediaPipeの初期化

```typescript
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let poseLandmarker: PoseLandmarker;

const initializePoseLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );
  
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
};
```

### 2.3 フレーム処理の実装

```typescript
const frameProcessor = useFrameProcessor((frame) => {
  'worklet';
  
  try {
    // フレームをMediaPipeに入力
    const results = poseLandmarker.detectForVideo(frame, Date.now());
    
    if (results.landmarks && results.landmarks.length > 0) {
      const pose: PoseData = {
        landmarks: results.landmarks[0].map((lm) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
          visibility: lm.visibility,
        })),
      };
      
      // JS側で処理
      runOnJS(updatePoseData)(pose);
    }
  } catch (error) {
    console.error('Frame processing error:', error);
  }
}, []);
```

---

## 3. Skia によるリアルタイムオーバーレイ描画

### 3.1 Skia Canvas の設定

```typescript
import { Canvas, Circle, Group, Paint } from '@shopify/react-native-skia';

<Canvas style={StyleSheet.absoluteFill}>
  <Group>
    {/* キーポイント描画 */}
    {poseData?.landmarks.map((keypoint, index) => {
      if ((keypoint.visibility ?? 0) < 0.5) return null;
      
      const screenX = keypoint.x * screenWidth;
      const screenY = keypoint.y * screenHeight;
      
      // 下半身は赤色、その他は青色
      const isLowerBody = [23, 24, 25, 26, 27, 28].includes(index);
      const color = isLowerBody ? '#FF6B6B' : '#00D9FF';
      
      return (
        <Circle
          key={`keypoint-${index}`}
          cx={screenX}
          cy={screenY}
          r={6}
          color={color}
        />
      );
    })}
  </Group>
</Canvas>
```

### 3.2 パフォーマンス最適化

**GPU加速の活用：**

- Skiaは自動的にGPUを使用します
- 描画オブジェクトの再作成を最小化
- 不要なキーポイントはスキップ

**メモリ管理：**

```typescript
// 信頼度が低いキーポイントはスキップ
if ((keypoint.visibility ?? 0) < 0.5) return null;

// 古いフレームデータを破棄
useEffect(() => {
  return () => {
    setPoseData(null);
  };
}, []);
```

---

## 4. カメラパーミッション管理

### 4.1 パーミッション確認

```typescript
import { useCameraPermissions } from 'expo-camera';

const [permission, requestPermission] = useCameraPermissions();

useEffect(() => {
  if (!permission?.granted) {
    requestPermission();
  }
}, [permission, requestPermission]);
```

### 4.2 エラーハンドリング

```typescript
if (!permission?.granted) {
  return (
    <View style={styles.container}>
      <Text style={styles.errorText}>
        カメラへのアクセスが許可されていません
      </Text>
    </View>
  );
}
```

---

## 5. 実装チェックリスト

タスクBの実装を完了するには、以下の項目を確認してください：

| 項目 | 状態 | 説明 |
|---|---|---|
| 型定義 | ✅ | `lib/types/pose.ts` で定義済み |
| カメラコンポーネント | ✅ | `components/game-camera.tsx` で実装済み |
| 骨格検知フック | ✅ | `hooks/use-pose-detection.ts` で実装済み |
| 骨格処理ユーティリティ | ✅ | `lib/pose-processor.ts` で実装済み |
| ゲーム画面 | ✅ | `app/(tabs)/game.tsx` で実装済み |
| Frame Processor | ⏳ | MediaPipeの統合が必要 |
| Skia オーバーレイ | ⏳ | Canvas描画の完全実装が必要 |
| パーミッション管理 | ✅ | `app.config.ts` で設定済み |

---

## 6. 次のステップ

### 6.1 MediaPipeの統合

1. MediaPipeのWasm初期化コードを`useFrameProcessor`に統合
2. フレーム処理ループでPose Detectionを実行
3. 検知結果をPoseDataに変換

### 6.2 Skia描画の完全実装

1. `game-camera.tsx`の`renderKeypoints()`関数を完成
2. Canvas、Circle、Groupコンポーネントを使用
3. 下半身キーポイント（足首、膝、股関節）を赤色で描画

### 6.3 パフォーマンステスト

1. フレームレート測定（目標：30fps以上）
2. メモリ使用量監視
3. バッテリー消費テスト

---

## 7. トラブルシューティング

### 7.1 カメラが起動しない

**原因：** パーミッションが許可されていない

**解決方法：**
```bash
# iOS: Info.plistを確認
# Android: AndroidManifest.xmlを確認
pnpm check
```

### 7.2 骨格検知が動作しない

**原因：** MediaPipeのWasm初期化失敗

**解決方法：**
```typescript
// ネットワーク接続を確認
// CDNからのリソース読み込みを確認
console.log('MediaPipe initialization:', poseLandmarker);
```

### 7.3 フレームレートが低い

**原因：** Frame Processor内で重い処理を実行

**解決方法：**
- 信頼度チェックを追加してキーポイント数を削減
- スムージング処理を軽量化
- 不要なデータ変換を削除

---

## 参考資料

| リソース | URL |
|---------|-----|
| react-native-vision-camera | https://react-native-vision-camera.com/ |
| MediaPipe Pose | https://developers.google.com/mediapipe/solutions/vision/pose_detector |
| react-native-skia | https://shopify.github.io/react-native-skia/ |
| Expo Camera | https://docs.expo.dev/build-reference/camera/ |
