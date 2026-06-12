# ボレーシュートチャレンジ: オンデバイス足認識仕様

## 絶対遵守

- カメラ映像を端末外に送信しない。
- ネットワークへフレーム、画像、ランドマークを送るコードを書かない。
- OpenAI / GCP / AWS などの有料クラウドAI APIを使わない。
- 姿勢推定は完全オンデバイスで行う。
- 運用コストはEAS Build費用のみ。ユーザー増加によるAI従量課金を発生させない。
- Expo Go非対応でよい。Expo dev-client / EAS Build前提。

## 採用スタック

- Expo dev-client
- react-native-vision-camera
- react-native-worklets-core
- react-native-fast-tflite
- MediaPipe BlazePose Lite TFLite
- @shopify/react-native-skia
- zustand
- requestAnimationFrame based game loop

MoveNetはheel / foot_indexが取れないため採用しない。

## Step 1: カメラ + 推論パイプライン

フロントカメラを `resizeMode: cover` で表示し、frame processorでBlazePose Liteを15-20fps目標で実行する。

動作確認コード:

```ts
import { buildPoseFrameFromBlazePose } from "@/lib/pose/on-device-pipeline";
import { assertNoNetworkFrameTransport } from "@/lib/pose/on-device-pipeline";

console.log(assertNoNetworkFrameTransport());

const poseFrame = buildPoseFrameFromBlazePose(
  blazePoseOutput,
  {
    frame: { width: 256, height: 256 },
    view: { width: screenWidth, height: screenHeight },
    mirrored: true,
  },
  bodyScale,
);

console.log(poseFrame.leftFoot?.footIndex, poseFrame.rightFoot?.footIndex);
```

## Step 2: 座標変換 + デバッグオーバーレイ

`modelToCoverViewPoint` で、モデル座標から画面座標へ変換する。

対応済み:

- フロントカメラ左右ミラー
- cover表示のスケール補正
- cover表示のクロップ補正

動作確認コード:

```ts
import { modelToCoverViewPoint } from "@/lib/pose/coordinate-transform";

const point = modelToCoverViewPoint(landmark, {
  frame: { width: 256, height: 256 },
  view: { width: 932, height: 430 },
  mirrored: true,
});

console.log(point.x, point.y);
```

Skiaデバッグオーバーレイでは ankle / heel / foot_index を別色で描画する。

## Step 3: ランドマーク後処理

`FootPostProcessor` が以下を担当する。

- One Euro Filterで平滑化
- 直近フレームから足速度ベクトル算出
- 推論レイテンシぶん線形外挿
- visibility < 0.6 を判定対象から除外

動作確認コード:

```ts
import { FootPostProcessor } from "@/lib/pose/foot-postprocessor";

const processor = new FootPostProcessor();
const leftFoot = processor.toScreenFoot("left", lowerBody, transform, Date.now(), measuredLatencyMs, bodyScale);

console.log(leftFoot?.normalizedSpeed, leftFoot?.stableFrames, leftFoot?.confidence);
```

## Step 4: ボール + ボレー判定

ヒット条件はANDで判定する。

- foot_indexとankleの重み付き中点で近似した足の甲が、ボール判定円へ進入
- 足のスイング速度がしきい値以上
- visibility条件を満たす
- ボール到達時刻±150ms以内
- 足の移動方向がおおむねボールへ向かっている

動作確認コード:

```ts
import { judgeVolleyHit } from "@/lib/pose/volley-judge";

const result = judgeVolleyHit(leftFoot, ball, performance.now(), bodyScale);
console.log(result.grade, result.reason);
```

静止した足はボールと重なっていても `reason: "speed"` でMISSになる。足がボールから遠ざかっている場合は `reason: "direction"` でMISSになる。

## 実装メモ

最終製品では、現在のタッチ式FOOTトラッカーをVisionCamera + BlazePose Liteの `foot_index` 入力へ差し替える。ゲーム判定側は `ScreenFootLandmarks` を受け取るため、入力元が手動でもAIでも同じ判定ロジックを使える。
