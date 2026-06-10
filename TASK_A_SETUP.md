# タスクA：環境構築 - 完全セットアップガイド

このドキュメントは、「ボレーシュートチャレンジ」アプリの開発環境を構築するための完全なガイドです。必要なライブラリのインストールと、`app.config.ts`の設定を含みます。

---

## 1. 必要なライブラリのインストール

以下のコマンドを順番に実行してください。これらのライブラリは、カメラ、骨格検知、GPU加速グラフィックス、ワークレット処理に必要です。

### 1.1 react-native-vision-camera のインストール

```bash
cd /home/ubuntu/VolleyShootChallenge
pnpm add react-native-vision-camera
```

**説明**: `react-native-vision-camera`は、React Nativeアプリでカメラにアクセスするための高性能なライブラリです。リアルタイムのフレーム処理をサポートし、Frame Processorを通じてMediaPipeなどのビジョンタスクを実行できます。

### 1.2 react-native-skia のインストール

```bash
pnpm add react-native-skia
```

**説明**: `react-native-skia`は、Skiaグラフィックスエンジンを使用してGPUアクセラレーションされた描画を実現します。ボール、骨格ポイント、エフェクトなどの高速レンダリングに必須です。

### 1.3 react-native-worklets-core のインストール

```bash
pnpm add react-native-worklets-core
```

**説明**: `react-native-worklets-core`は、JavaScriptコードをネイティブスレッドで実行するためのワークレット機能を提供します。Frame Processorの高速処理に必要です。

### 1.4 vision-camera-pose-detection のインストール

```bash
pnpm add vision-camera-pose-detection
```

**説明**: `vision-camera-pose-detection`は、MediaPipeを使用した骨格検知（Pose Detection）をFrame Processor内で実行します。足首、膝、股関節などのキーポイントをリアルタイムで検知します。

### 1.5 react-native-reanimated のバージョン確認

```bash
pnpm list react-native-reanimated
```

**説明**: `react-native-reanimated`は既にインストール済み（バージョン4.1.6）です。ボールのアニメーションに使用します。

---

## 2. app.config.ts の設定更新

### 2.1 カメラパーミッション設定

`app.config.ts`の`plugins`セクションに、カメラパーミッション用の設定を追加します。以下の設定を`plugins`配列に追加してください。

```typescript
[
  "expo-camera",
  {
    cameraPermission: "Allow $(PRODUCT_NAME) to access your camera.",
    microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
    recordAudioAndroid: true,
  },
],
```

### 2.2 iOS 固有の設定

`app.config.ts`の`ios`セクションの`infoPlist`に、カメラ使用説明を追加します。

```typescript
ios: {
  supportsTablet: true,
  bundleIdentifier: env.iosBundleId,
  infoPlist: {
    ITSAppUsesNonExemptEncryption: false,
    NSCameraUsageDescription: "このアプリはボール検知とユーザーのキック動作を認識するためにカメラを使用します。",
    NSMicrophoneUsageDescription: "オーディオ処理用にマイクへのアクセスが必要です。",
  },
},
```

### 2.3 Android 固有の設定

`app.config.ts`の`android`セクションの`permissions`配列に、カメラパーミッションを追加します。

```typescript
android: {
  // ... 既存の設定 ...
  permissions: [
    "android.permission.CAMERA",
    "android.permission.RECORD_AUDIO",
    "POST_NOTIFICATIONS",
  ],
  // ... その他の設定 ...
},
```

---

## 3. 更新後の app.config.ts 全体構成

以下は、上記の設定を反映した`app.config.ts`の完全な例です。

```typescript
// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const rawBundleId = "com.app.VolleyShootChallenge";
const bundleId =
  rawBundleId
    .replace(/[-_]/g, ".")
    .replace(/[^a-zA-Z0-9.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase()
    .split(".")
    .map((segment) => {
      return /^[a-zA-Z]/.test(segment) ? segment : "x" + segment;
    })
    .join(".") || "space.manus.app";

const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  appName: "ボレーシュートチャレンジ",
  appSlug: "VolleyShootChallenge",
  logoUrl: "",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        "このアプリはボール検知とユーザーのキック動作を認識するためにカメラを使用します。",
      NSMicrophoneUsageDescription: "オーディオ処理用にマイクへのアクセスが必要です。",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "POST_NOTIFICATIONS",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-camera",
      {
        cameraPermission: "Allow $(PRODUCT_NAME) to access your camera.",
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
        recordAudioAndroid: true,
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
```

---

## 4. package.json の確認

以下のスクリプトが`package.json`に含まれていることを確認してください。これらは開発とビルドに必要です。

| スクリプト | 説明 |
|-----------|------|
| `pnpm dev` | 開発サーバーとMetro Bundlerを起動 |
| `pnpm ios` | iOS シミュレータで実行 |
| `pnpm android` | Android エミュレータで実行 |
| `pnpm check` | TypeScript 型チェック |
| `pnpm lint` | ESLint による静的解析 |
| `pnpm test` | Vitest によるユニットテスト実行 |

---

## 5. インストール完了後の確認

### 5.1 依存関係の確認

```bash
pnpm list react-native-vision-camera react-native-skia react-native-worklets-core vision-camera-pose-detection
```

すべてのライブラリが正常にインストールされていることを確認してください。

### 5.2 TypeScript 型チェック

```bash
pnpm check
```

型エラーがないことを確認してください。

### 5.3 開発サーバーの起動（オプション）

```bash
pnpm dev
```

開発サーバーが正常に起動することを確認してください。

---

## 6. トラブルシューティング

### 6.1 ライブラリインストール失敗時

```bash
pnpm install --force
```

キャッシュをクリアして再インストールしてください。

### 6.2 型定義エラー

```bash
pnpm check
```

型定義ファイルが正しく生成されているか確認してください。必要に応じて、`@types/`パッケージをインストールしてください。

### 6.3 ビルドエラー

```bash
pnpm lint
pnpm check
```

構文エラーと型エラーを修正してください。

---

## 7. 次のステップ

タスクAの環境構築が完了したら、**タスクB：カメラと骨格検知の実装**に進みます。

- カメラビューコンポーネントの作成
- Frame Processorの実装
- Skiaを使用したリアルタイムオーバーレイ描画

詳細は`TASK_B_IMPLEMENTATION.md`を参照してください。

---

## 参考資料

| リソース | URL |
|---------|-----|
| react-native-vision-camera | https://react-native-vision-camera.com/ |
| react-native-skia | https://shopify.github.io/react-native-skia/ |
| vision-camera-pose-detection | https://github.com/mrousavy/vision-camera-pose-detection |
| Expo カメラ | https://docs.expo.dev/build-reference/camera/ |
| MediaPipe Pose | https://developers.google.com/mediapipe/solutions/vision/pose_detector |
