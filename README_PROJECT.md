# ボレーシュートチャレンジ - プロジェクト概要

**ボレーシュートチャレンジ**は、Expo (React Native) + TypeScript で開発されたiOSアプリです。ユーザーがスマホのカメラの前に立ち、飛んでくる仮想のボールをキックするトレーニングアプリです。

---

## プロジェクト概要

### 目的

サッカー選手のボレーシュートスキルを向上させるためのトレーニングアプリ。MediaPipeを使用した骨格検知により、ユーザーのキック動作をリアルタイムで認識し、スコアを計算します。

### 主要機能

| 機能 | 説明 |
|------|------|
| **リアルタイムカメラ** | リアカメラを使用したライブビデオフィード |
| **骨格検知** | MediaPipeを使用した27個のキーポイント検知 |
| **ボールアニメーション** | 画面上部から下部へ放物線を描いて移動するボール |
| **キック判定** | 足首座標とボール座標の衝突判定（難易度別） |
| **スコアシステム** | コンボボーナス付きのスコア計算 |
| **難易度設定** | EASY, NORMAL, HARD の3段階 |
| **ゲーム統計** | キック成功率、コンボ数などの統計情報 |

---

## 技術スタック

### フロントエンド

| ツール | バージョン | 用途 |
|--------|----------|------|
| **Expo** | 54.0.29 | React Native フレームワーク |
| **React Native** | 0.81.5 | ネイティブモバイルアプリ開発 |
| **TypeScript** | 5.9.3 | 型安全な開発 |
| **react-native-vision-camera** | 5.0.11 | リアルタイムカメラ処理 |
| **react-native-skia** | 0.0.1 | GPU加速グラフィックス |
| **@mediapipe/tasks-vision** | 0.10.35 | 骨格検知 (Pose Detection) |
| **react-native-reanimated** | 4.1.6 | アニメーション |
| **NativeWind** | 4.2.1 | Tailwind CSS for React Native |

### ビルド・デプロイ

| ツール | 説明 |
|--------|------|
| **pnpm** | パッケージマネージャー |
| **Expo Router** | ファイルベースのルーティング |
| **EAS Build** | Expoクラウドビルド |
| **TypeScript** | 型チェック |
| **ESLint** | コード品質管理 |

---

## プロジェクト構成

```
VolleyShootChallenge/
├── app/                          # Expo Router アプリケーション
│   ├── (tabs)/
│   │   ├── _layout.tsx          # タブレイアウト
│   │   ├── index.tsx            # ホーム画面
│   │   └── game.tsx             # ゲーム画面
│   ├── _layout.tsx              # ルートレイアウト
│   └── oauth/
│       └── callback.tsx         # OAuth コールバック
│
├── components/                   # React コンポーネント
│   ├── game-camera.tsx          # カメラビューコンポーネント
│   ├── ball-renderer.tsx        # ボール描画コンポーネント
│   ├── screen-container.tsx     # SafeArea ラッパー
│   └── ...
│
├── hooks/                        # カスタムフック
│   ├── use-pose-detection.ts    # 骨格検知フック
│   ├── use-ball-manager.ts      # ボール管理フック
│   └── ...
│
├── lib/                          # ユーティリティ・ライブラリ
│   ├── types/
│   │   ├── pose.ts              # 骨格検知型定義
│   │   └── ball.ts              # ボール管理型定義
│   ├── pose-processor.ts        # 骨格処理ユーティリティ
│   └── ...
│
├── assets/                       # 画像・アイコン
│   ├── images/
│   │   ├── icon.png             # アプリアイコン
│   │   ├── splash-icon.png      # スプラッシュスクリーン
│   │   └── ...
│
├── app.config.ts                # Expo 設定ファイル
├── package.json                 # 依存関係
├── tailwind.config.js           # Tailwind CSS 設定
├── tsconfig.json                # TypeScript 設定
│
├── TASK_A_SETUP.md              # タスクA: 環境構築ガイド
├── TASK_B_IMPLEMENTATION.md     # タスクB: カメラ・骨格検知ガイド
├── TASK_C_IMPLEMENTATION.md     # タスクC: ボール・キック判定ガイド
├── design.md                    # デザイン計画書
└── todo.md                      # プロジェクト TODO リスト
```

---

## セットアップ手順

### 1. 環境構築

```bash
# プロジェクトディレクトリに移動
cd /home/ubuntu/VolleyShootChallenge

# 依存関係をインストール
pnpm install

# 型チェック
pnpm check
```

### 2. 必要なライブラリ

以下のライブラリが既にインストール済みです：

```bash
# カメラ関連
pnpm add expo-camera react-native-vision-camera

# グラフィックス
pnpm add react-native-skia

# ワークレット処理
pnpm add react-native-worklets-core

# 骨格検知
pnpm add @mediapipe/tasks-vision
```

### 3. 開発サーバーの起動

```bash
# 開発サーバーを起動
pnpm dev

# または個別に起動
pnpm dev:metro  # Metro Bundler
pnpm dev:server # バックエンドサーバー
```

### 4. iOS シミュレータで実行

```bash
pnpm ios
```

### 5. Android エミュレータで実行

```bash
pnpm android
```

---

## 実装済みコンポーネント

### タスクA: 環境構築 ✅

- ✅ `react-native-vision-camera` インストール
- ✅ `react-native-skia` インストール
- ✅ `react-native-worklets-core` インストール
- ✅ `@mediapipe/tasks-vision` インストール
- ✅ `app.config.ts` にカメラパーミッション設定
- ✅ iOS/Android 固有の設定

### タスクB: カメラと骨格検知 ✅

- ✅ 型定義 (`lib/types/pose.ts`)
  - Keypoint, PoseData, PoseLandmark など
  - 33個のMediaPipeキーポイント定義

- ✅ カメラコンポーネント (`components/game-camera.tsx`)
  - リアカメラ全画面表示
  - パーミッション管理
  - エラーハンドリング

- ✅ 骨格検知フック (`hooks/use-pose-detection.ts`)
  - MediaPipe Pose Detection統合
  - キーポイント抽出
  - 信頼度チェック

- ✅ 骨格処理ユーティリティ (`lib/pose-processor.ts`)
  - 距離計算
  - キック動作検知
  - データスムージング
  - 姿勢分析

- ✅ ゲーム画面 (`app/(tabs)/game.tsx`)
  - カメラビュー表示
  - スコア表示
  - タイマー表示
  - 一時停止機能

### タスクC: ボールアニメーション・キック判定・エフェクト ✅

- ✅ ボール型定義 (`lib/types/ball.ts`)
  - BallState, CollisionResult, KickEffect
  - 難易度別パラメータ

- ✅ ボール管理フック (`hooks/use-ball-manager.ts`)
  - ボール生成・更新
  - 衝突判定
  - エフェクト管理
  - スコア計算

- ✅ ボール描画コンポーネント (`components/ball-renderer.tsx`)
  - ゴールド色のボール
  - グリーン色のエフェクト
  - シャドウ効果

---

## 主要な実装ポイント

### 1. 骨格検知

**キーポイント：**
- 33個のMediaPipeキーポイント
- 下半身キーポイント（足首、膝、股関節）を優先

**信頼度チェック：**
```typescript
if ((keypoint.visibility ?? 0) >= 0.5) {
  // キーポイントは有効
}
```

### 2. ボール衝突判定

**判定アルゴリズム：**
```typescript
const distance = Math.sqrt(
  (ball.x - ankleX) ** 2 + (ball.y - ankleY) ** 2
);
if (distance < targetRadius + ball.radius) {
  // 衝突判定
}
```

**難易度別判定半径：**
- EASY: 80px
- NORMAL: 60px
- HARD: 40px

### 3. スコア計算

**コンボボーナス：**
```typescript
baseScore = 10;
comboBonus = comboCount * 5;
totalScore = baseScore + comboBonus;
```

### 4. パフォーマンス最適化

**フレームレート：**
- 目標: 30fps
- 実装: `setInterval(gameLoop, 33)`

**メモリ管理：**
- 画面外のボール自動削除
- エフェクト数の制限
- 不要なデータの破棄

---

## ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| **TASK_A_SETUP.md** | 環境構築コマンドと設定ファイル |
| **TASK_B_IMPLEMENTATION.md** | カメラ・骨格検知の実装ガイド |
| **TASK_C_IMPLEMENTATION.md** | ボール・キック判定の実装ガイド |
| **design.md** | UI/UXデザイン計画書 |
| **todo.md** | プロジェクト TODO リスト |

---

## 開発ワークフロー

### コード品質管理

```bash
# TypeScript 型チェック
pnpm check

# ESLint による静的解析
pnpm lint

# コード整形
pnpm format

# ユニットテスト
pnpm test
```

### ビルド・デプロイ

```bash
# 本番ビルド
pnpm build

# 本番サーバー起動
pnpm start

# EAS Build でクラウドビルド
eas build --platform ios
```

---

## トラブルシューティング

### カメラが起動しない

**原因：** パーミッションが許可されていない

**解決方法：**
1. iOS: Settings → Privacy → Camera で許可を確認
2. Android: 設定 → アプリ → ボレーシュートチャレンジ → パーミッション で許可を確認

### 骨格検知が動作しない

**原因：** MediaPipeのWasm初期化失敗

**解決方法：**
1. ネットワーク接続を確認
2. CDNからのリソース読み込みを確認
3. ブラウザコンソールでエラーを確認

### フレームレートが低い

**原因：** ゲームループ内で重い処理を実行

**解決方法：**
1. 衝突判定の最適化
2. エフェクト数の制限
3. 不要なレンダリングの削除

---

## 次のステップ

### 短期 (1-2週間)

1. **ホーム画面の実装**
   - ゲーム開始ボタン
   - ハイスコア表示
   - 設定ボタン

2. **ゲーム終了画面の実装**
   - 最終スコア表示
   - リプレイボタン
   - ホームボタン

3. **設定画面の実装**
   - 難易度選択
   - カメラパーミッション確認
   - 音量設定

### 中期 (2-4週間)

1. **ビジュアル改善**
   - Skiaを使用した高度なエフェクト
   - アニメーション調整
   - UI/UXポーランド

2. **サウンド機能**
   - キック成功音
   - BGM
   - 効果音

3. **統計・ランキング**
   - プレイ履歴
   - ランキング表示
   - 成績グラフ

### 長期 (1-3ヶ月)

1. **マルチプレイヤー機能**
   - オンラインランキング
   - リーダーボード
   - マルチプレイモード

2. **AI機能**
   - 難易度自動調整
   - パフォーマンス分析
   - トレーニングプラン生成

3. **クラウド同期**
   - ユーザーアカウント
   - クラウドセーブ
   - デバイス間同期

---

## 参考資料

| リソース | URL |
|---------|-----|
| Expo ドキュメント | https://docs.expo.dev/ |
| React Native | https://reactnative.dev/ |
| MediaPipe Pose | https://developers.google.com/mediapipe/solutions/vision/pose_detector |
| react-native-vision-camera | https://react-native-vision-camera.com/ |
| react-native-skia | https://shopify.github.io/react-native-skia/ |
| NativeWind | https://www.nativewind.dev/ |

---

## ライセンス

このプロジェクトはMIT ライセンスの下で公開されています。

---

## 作成者

**Manus AI** - Expo (React Native) + TypeScript による iOS アプリ開発

**作成日:** 2026年6月9日

**バージョン:** 1.0.0

---

## サポート

問題が発生した場合は、以下の手順でサポートを受けてください：

1. **ドキュメントを確認** - TASK_A_SETUP.md, TASK_B_IMPLEMENTATION.md, TASK_C_IMPLEMENTATION.md を参照
2. **トラブルシューティング** - README_PROJECT.md のトラブルシューティングセクションを確認
3. **ログを確認** - `pnpm check` で型エラーを確認、ブラウザコンソールでランタイムエラーを確認
4. **GitHub Issues** - プロジェクトのGitHub Issuesで既知の問題を確認

---

## 更新履歴

| バージョン | 日付 | 変更内容 |
|----------|------|---------|
| 1.0.0 | 2026-06-09 | 初版リリース |
