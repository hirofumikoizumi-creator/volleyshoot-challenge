# ボレーシュートチャレンジ - アーキテクチャドキュメント

このドキュメントは、「ボレーシュートチャレンジ」アプリのアーキテクチャ、データフロー、コンポーネント間の関係を説明します。

---

## システムアーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│                      Expo (React Native)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │   UI Layer       │  │  Game Logic      │  │  State     │ │
│  │                  │  │                  │  │  Management│ │
│  │ - GameCamera     │  │ - useBallManager │  │ - useState │ │
│  │ - BallRenderer   │  │ - usePoseDetect  │  │ - useRef   │ │
│  │ - ScreenContainer│  │ - Collision Detect│  │ - AsyncStor│ │
│  └──────────────────┘  └──────────────────┘  └────────────┘ │
│         ▲                     ▲                      ▲        │
│         │                     │                      │        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Core Libraries & Utilities                 │   │
│  │                                                       │   │
│  │  - lib/types/pose.ts (骨格検知型)                    │   │
│  │  - lib/types/ball.ts (ボール管理型)                  │   │
│  │  - lib/pose-processor.ts (骨格処理)                  │   │
│  │  - hooks/use-pose-detection.ts                       │   │
│  │  - hooks/use-ball-manager.ts                         │   │
│  └──────────────────────────────────────────────────────┘   │
│         ▲                                                     │
│         │                                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Native Modules & External APIs               │   │
│  │                                                       │   │
│  │  - expo-camera (カメラアクセス)                       │   │
│  │  - react-native-vision-camera (フレーム処理)         │   │
│  │  - @mediapipe/tasks-vision (骨格検知)                │   │
│  │  - react-native-skia (GPU描画)                       │   │
│  │  - react-native-reanimated (アニメーション)          │   │
│  └──────────────────────────────────────────────────────┘   │
│         ▲                                                     │
└─────────────────────────────────────────────────────────────┘
         │
    ┌────┴─────────────────────────────────────┐
    │                                           │
┌───▼────────┐                         ┌──────▼────┐
│   Camera   │                         │  MediaPipe│
│  Hardware  │                         │  Wasm     │
└────────────┘                         └───────────┘
```

---

## データフロー

### 1. ゲーム開始フロー

```
ユーザー
  │
  ├─ ゲーム開始ボタンをタップ
  │
  ▼
GameScreen (app/(tabs)/game.tsx)
  │
  ├─ usePoseDetection() フックを初期化
  ├─ useBallManager() フックを初期化
  │
  ▼
GameCamera コンポーネント
  │
  ├─ カメラパーミッション確認
  ├─ リアカメラを起動
  │
  ▼
Frame Processor (react-native-vision-camera)
  │
  ├─ リアルタイムフレームを取得
  ├─ MediaPipe Pose Detection で骨格検知
  │
  ▼
PoseData (33個のキーポイント)
  │
  ├─ 信頼度チェック
  ├─ 下半身キーポイント抽出
  │
  ▼
GameScreen (状態更新)
  │
  ├─ poseData 状態を更新
  ├─ GameCamera に渡す
  ├─ 衝突判定実行
  │
  ▼
BallRenderer コンポーネント
  │
  └─ ボールとエフェクトを描画
```

### 2. ボール生成と衝突判定フロー

```
ゲームループ (33ms 間隔)
  │
  ├─ spawnBall()
  │  │
  │  └─ 新しいボールを生成
  │     ├─ ランダムな開始位置
  │     ├─ ランダムなターゲット位置
  │     └─ 難易度別パラメータを適用
  │
  ├─ updateBalls()
  │  │
  │  └─ 各ボールの位置を更新
  │     ├─ 水平速度を適用
  │     ├─ 重力を適用
  │     └─ 画面外のボールを削除
  │
  ├─ checkCollision()
  │  │
  │  └─ 足首とボールの距離を計算
  │     ├─ 距離 < 判定半径 → 衝突
  │     └─ 衝突強度を計算
  │
  ├─ kickBall()
  │  │
  │  └─ ボール消去とエフェクト生成
  │     ├─ ボールを非アクティブ化
  │     ├─ キック成功エフェクトを生成
  │     └─ スコア加算
  │
  └─ updateEffects()
     │
     └─ 各エフェクトを更新
        ├─ 位置を更新（重力適用）
        ├─ 透明度を減少
        └─ 寿命切れのエフェクトを削除
```

### 3. スコア計算フロー

```
キック成功
  │
  ├─ baseScore = 10
  │
  ├─ comboBonus = comboCount * 5
  │  │
  │  └─ コンボ数に基づくボーナス
  │
  ├─ totalScore = baseScore + comboBonus
  │
  └─ スコア状態を更新
     ├─ totalScore を加算
     ├─ comboCount をインクリメント
     ├─ lastKickTime を更新
     └─ kickCount をインクリメント

コンボタイムアウト (2秒以上キック無し)
  │
  └─ comboCount をリセット
```

---

## コンポーネント設計

### UI層

#### GameCamera (`components/game-camera.tsx`)

**責務：**
- リアカメラの全画面表示
- カメラパーミッション管理
- 骨格キーポイントのオーバーレイ描画

**入力：**
- `poseData`: PoseData | null
- `showKeypoints`: boolean

**出力：**
- CameraView ref

**依存関係：**
- expo-camera
- @shopify/react-native-skia

#### BallRenderer (`components/ball-renderer.tsx`)

**責務：**
- ボールの描画
- キック成功エフェクトの描画

**入力：**
- `balls`: BallState[]
- `effects`: KickEffect[]

**出力：**
- なし（副作用のみ）

**依存関係：**
- react-native

### ロジック層

#### usePoseDetection (`hooks/use-pose-detection.ts`)

**責務：**
- MediaPipe Pose Detectionの初期化
- フレームから骨格を検知
- キーポイント抽出

**状態：**
- `poseData`: PoseData | null
- `isLoading`: boolean
- `error`: string | null

**メソッド：**
- `detectPose(imageData)`: Promise<PoseData | null>
- `getLowerBodyKeypoints()`: LowerBodyKeypoints
- `isKeypointVisible(keypoint, threshold)`: boolean

#### useBallManager (`hooks/use-ball-manager.ts`)

**責務：**
- ボール生成と管理
- 衝突判定
- エフェクト管理
- スコア計算

**状態：**
- `balls`: BallState[]
- `effects`: KickEffect[]
- `score`: GameScore

**メソッド：**
- `spawnBall()`: void
- `updateBalls()`: void
- `checkCollision(anklePosition)`: CollisionResult
- `kickBall(ballId, collisionPoint)`: void
- `updateEffects()`: void
- `resetCombo()`: void
- `resetGame()`: void

### ユーティリティ層

#### pose-processor (`lib/pose-processor.ts`)

**関数：**
- `calculateDistance(p1, p2)`: number
- `isKeypointValid(keypoint, threshold)`: boolean
- `normalizeToScreenCoords(keypoint, screenWidth, screenHeight)`: { x, y }
- `detectKickMotion(currentPose, previousPose)`: { isKick, leg }
- `smoothPoseData(currentPose, previousPose, factor)`: PoseData
- `analyzeLowerBodyPosture(pose)`: { isStanding, legSpread, balance }

---

## 状態管理

### ゲーム状態

```typescript
interface GameState {
  // ゲーム制御
  isGameActive: boolean;
  timeRemaining: number;
  difficulty: GameDifficulty;

  // 骨格検知
  poseData: PoseData | null;
  previousPoseData: PoseData | null;

  // ボール管理
  balls: BallState[];
  effects: KickEffect[];

  // スコア
  score: GameScore;
  stats: GameStats;
}
```

### 状態更新フロー

```
useState (React)
  │
  ├─ poseData (骨格検知結果)
  ├─ balls (ボール配列)
  ├─ effects (エフェクト配列)
  ├─ score (スコア情報)
  └─ isGameActive (ゲーム状態)
  │
  ▼
useRef (参照保持)
  │
  ├─ gameLoopRef (ゲームループタイマー)
  ├─ ballIdRef (ボールID生成用)
  └─ effectIdRef (エフェクトID生成用)
  │
  ▼
AsyncStorage (永続化)
  │
  ├─ lastScore
  ├─ highScore
  └─ gameStats
```

---

## パフォーマンス最適化戦略

### 1. フレームレート管理

**目標:** 30fps

```typescript
// ゲームループ
setInterval(() => {
  // 処理
}, 33); // 1000ms / 30fps ≈ 33ms
```

### 2. メモリ管理

**ボール数制限：**
```typescript
const MAX_BALLS = 10;
if (balls.length > MAX_BALLS) {
  setBalls((prev) => prev.slice(-MAX_BALLS));
}
```

**エフェクト数制限：**
```typescript
const MAX_EFFECTS = 20;
if (effects.length > MAX_EFFECTS) {
  setEffects((prev) => prev.slice(-MAX_EFFECTS));
}
```

### 3. 計算最適化

**信頼度チェック：**
```typescript
// 信頼度が低いキーポイントはスキップ
if ((keypoint.visibility ?? 0) < 0.5) return null;
```

**衝突判定最適化：**
```typescript
// 画面外のボールは判定対象外
if (ball.y > screenHeight + 50) return null;
```

### 4. GPU加速

**Skia描画：**
- Canvas, Circle, Group で GPU加速
- ネイティブスレッドでの処理

---

## エラーハンドリング

### カメラエラー

```typescript
if (!permission?.granted) {
  return (
    <View>
      <Text>カメラへのアクセスが許可されていません</Text>
    </View>
  );
}
```

### 骨格検知エラー

```typescript
try {
  const results = await detectPose(frame);
} catch (error) {
  console.error('Pose detection error:', error);
  setError(error.message);
}
```

### ゲームループエラー

```typescript
try {
  spawnBall();
  updateBalls();
  checkCollisions();
} catch (error) {
  console.error('Game loop error:', error);
  setIsGameActive(false);
}
```

---

## 拡張性設計

### 新機能追加の例

#### 1. サウンド機能の追加

```typescript
import { Audio } from 'expo-audio';

// hooks/use-sound-manager.ts
export function useSoundManager() {
  const [sounds, setSounds] = useState<{ [key: string]: Audio.Sound }>({});

  const playSound = async (soundName: string) => {
    const sound = sounds[soundName];
    if (sound) {
      await sound.playAsync();
    }
  };

  return { playSound };
}
```

#### 2. ランキング機能の追加

```typescript
// lib/types/ranking.ts
export interface RankingEntry {
  userId: string;
  score: number;
  timestamp: number;
  difficulty: GameDifficulty;
}

// hooks/use-ranking.ts
export function useRanking() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);

  const submitScore = async (score: number, difficulty: GameDifficulty) => {
    // サーバーにスコアを送信
  };

  return { rankings, submitScore };
}
```

#### 3. マルチプレイヤー機能の追加

```typescript
// lib/types/multiplayer.ts
export interface MultiplayerGame {
  gameId: string;
  players: Player[];
  scores: { [playerId: string]: number };
}

// hooks/use-multiplayer.ts
export function useMultiplayer() {
  const [game, setGame] = useState<MultiplayerGame | null>(null);

  const joinGame = async (gameId: string) => {
    // ゲームに参加
  };

  return { game, joinGame };
}
```

---

## テスト戦略

### ユニットテスト

```typescript
// tests/pose-processor.test.ts
describe('pose-processor', () => {
  test('calculateDistance', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 3, y: 4 };
    expect(calculateDistance(p1, p2)).toBe(5);
  });

  test('isKeypointValid', () => {
    const keypoint = { x: 0.5, y: 0.5, visibility: 0.8 };
    expect(isKeypointValid(keypoint, 0.5)).toBe(true);
  });
});
```

### 統合テスト

```typescript
// tests/game-integration.test.ts
describe('Game Integration', () => {
  test('Ball collision detection', () => {
    const ball = { x: 100, y: 100, radius: 15 };
    const ankle = { x: 105, y: 105 };
    expect(checkCollision(ankle, ball)).toBe(true);
  });
});
```

---

## デプロイメント

### ビルドプロセス

```bash
# 開発ビルド
eas build --platform ios --profile preview

# 本番ビルド
eas build --platform ios --profile production
```

### 配布

```bash
# App Store Connect へのアップロード
eas submit --platform ios
```

---

## 参考資料

| リソース | 説明 |
|---------|------|
| Expo Architecture | https://docs.expo.dev/build-reference/ |
| React Native Performance | https://reactnative.dev/docs/performance |
| MediaPipe Architecture | https://developers.google.com/mediapipe/framework_concepts |
