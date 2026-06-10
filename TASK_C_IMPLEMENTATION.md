# タスクC：ボールアニメーション・キック判定・エフェクト実装ガイド

このドキュメントは、「ボレーシュートチャレンジ」アプリのボール管理、キック判定、エフェクト処理の実装方法を説明します。

---

## 1. 実装済みコンポーネント概要

### 1.1 ボール型定義 (`lib/types/ball.ts`)

ボール管理に必要なすべての型定義を提供します：

| 型 | 説明 |
|---|---|
| `BallState` | ボールの位置、速度、状態 |
| `BallAnimationConfig` | ボールアニメーション設定 |
| `CollisionResult` | 衝突判定結果 |
| `KickEffect` | キック成功エフェクト |
| `GameScore` | ゲームスコア情報 |
| `GameDifficulty` | 難易度設定（EASY, NORMAL, HARD） |

**難易度別パラメータ：**

| パラメータ | EASY | NORMAL | HARD |
|-----------|------|--------|------|
| ボール速度 | 1.0x | 1.5x | 2.0x |
| スポーン間隔 | 1500ms | 1000ms | 600ms |
| キック判定半径 | 80px | 60px | 40px |
| 重力加速度 | 0.3 | 0.5 | 0.7 |

### 1.2 ボール管理フック (`hooks/use-ball-manager.ts`)

ボール生成、アニメーション、衝突判定を一元管理：

**提供される機能：**

| 関数 | 説明 |
|---|---|
| `spawnBall()` | 新しいボールを生成 |
| `updateBalls()` | ボール位置を更新（重力適用） |
| `checkCollision()` | 足首とボールの衝突判定 |
| `kickBall()` | ボール消去とエフェクト生成 |
| `updateEffects()` | エフェクトを更新 |
| `resetCombo()` | コンボをリセット |
| `resetGame()` | ゲームをリセット |

### 1.3 ボール描画コンポーネント (`components/ball-renderer.tsx`)

ボールとエフェクトをレンダリング：

- ゴールド色のボール（半径15px）
- グリーン色のキック成功エフェクト
- シャドウ効果でビジュアル強化

---

## 2. ボールアニメーション実装

### 2.1 放物線運動の実装

ボールは画面上部から下部へ放物線を描いて移動します：

```typescript
// ボール生成時
const newBall: BallState = {
  id: ballId,
  x: startX,
  y: startY,
  vx: (targetX - startX) / (duration / 16),  // 水平速度
  vy: initialVelocity,                         // 初期垂直速度
  radius: 15,
  isActive: true,
  createdAt: Date.now(),
};

// 毎フレーム更新
const newVy = ball.vy + gravity;  // 重力を適用
newBall.x = ball.x + ball.vx;    // 水平位置更新
newBall.y = ball.y + newVy;      // 垂直位置更新
```

### 2.2 パフォーマンス最適化

**フレームレート管理：**

```typescript
// ゲームループ（約30fps）
useEffect(() => {
  const gameLoop = setInterval(() => {
    spawnBall();
    updateBalls();
    updateEffects();
    checkAndHandleCollisions();
  }, 33); // 1000ms / 30fps ≈ 33ms

  return () => clearInterval(gameLoop);
}, []);
```

**メモリ管理：**

```typescript
// 画面外のボールは自動削除
if (ball.y > screenHeight + 50) {
  return { ...ball, isActive: false };
}

// 非アクティブなボールはフィルタリング
.filter((ball) => ball.isActive)
```

---

## 3. キック判定ロジック

### 3.1 衝突判定アルゴリズム

足首座標とボール座標の距離が判定半径以内で「キック成功」と判定：

```typescript
const checkCollision = (anklePosition: Keypoint): CollisionResult => {
  const ankleX = anklePosition.x * screenWidth;
  const ankleY = anklePosition.y * screenHeight;
  const targetRadius = difficultyParams.targetRadius; // 60px (NORMAL)

  for (const ball of balls) {
    const dx = ball.x - ankleX;
    const dy = ball.y - ankleY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 距離が判定半径以内で衝突
    if (distance < targetRadius + ball.radius) {
      const collisionForce = Math.max(
        0,
        1 - distance / (targetRadius + ball.radius)
      );

      return {
        hasCollision: true,
        ballId: ball.id,
        collisionPoint: { x: ball.x, y: ball.y },
        collisionForce,
      };
    }
  }

  return { hasCollision: false, ballId: null, collisionPoint: null, collisionForce: 0 };
};
```

### 3.2 判定半径の視覚化

判定半径は難易度によって異なります：

```typescript
// EASY: 80px（大きい、初心者向け）
// NORMAL: 60px（標準）
// HARD: 40px（小さい、上級者向け）

// ゲーム画面に判定範囲を描画（デバッグ用）
<Circle
  cx={ankleX}
  cy={ankleY}
  r={targetRadius}
  color="rgba(0, 217, 255, 0.2)"
  strokeWidth={2}
  stroke="#00D9FF"
/>
```

---

## 4. キック成功エフェクト

### 4.1 エフェクト生成

キック成功時にパーティクルエフェクトを生成：

```typescript
const kickBall = (ballId: string, collisionPoint: { x: number; y: number }) => {
  // ボールを削除
  setBalls((prev) =>
    prev.map((ball) =>
      ball.id === ballId ? { ...ball, isActive: false } : ball
    )
  );

  // キック成功エフェクトを生成
  const effect: KickEffect = {
    id: `effect-${effectIdRef.current++}`,
    x: collisionPoint.x,
    y: collisionPoint.y,
    vx: (Math.random() - 0.5) * 4,        // ランダムな水平速度
    vy: (Math.random() - 0.5) * 4 - 2,    // ランダムな垂直速度
    lifetime: 500,                         // 500ms間表示
    createdAt: Date.now(),
    type: 'particle',
  };

  setEffects((prev) => [...prev, effect]);

  // スコア更新
  updateScore();
};
```

### 4.2 エフェクトアニメーション

エフェクトは時間とともに消滅し、スケールと透明度が変化：

```typescript
const updateEffects = () => {
  setEffects((prev) => {
    const now = Date.now();
    return prev
      .map((effect) => {
        const age = now - effect.createdAt;
        if (age > effect.lifetime) return null;

        const progress = age / effect.lifetime;

        return {
          ...effect,
          x: effect.x + effect.vx,
          y: effect.y + effect.vy,
          vy: effect.vy + 0.2,  // 重力で下降
          opacity: 1 - progress, // 透明度減少
          scale: 1 + progress * 0.5, // スケール増加
        };
      })
      .filter((e) => e !== null);
  });
};
```

### 4.3 ビジュアル効果

**ボール消滅エフェクト：**

- グリーン色のパーティクル
- 放射状に拡散
- 500ms間表示
- グロー効果で視認性向上

**スコア表示：**

```typescript
// キック成功時のスコア計算
baseScore = 10;
comboBoーナス = comboCount * 5;
totalScore = baseScore + comboBoーナス;
```

---

## 5. ゲームループ統合

### 5.1 ゲーム画面の更新

```typescript
useEffect(() => {
  if (!isGameActive) return;

  const gameLoop = setInterval(() => {
    // 1. ボール生成
    spawnBall();

    // 2. ボール更新（アニメーション）
    updateBalls();

    // 3. エフェクト更新
    updateEffects();

    // 4. 衝突判定
    const collision = checkCollision(currentAnklePosition);
    if (collision.hasCollision && collision.ballId) {
      kickBall(collision.ballId, collision.collisionPoint);
    }

    // 5. コンボタイムアウト
    if (Date.now() - score.lastKickTime > 2000) {
      resetCombo();
    }
  }, 33); // 約30fps

  return () => clearInterval(gameLoop);
}, [isGameActive]);
```

### 5.2 ゲーム終了時の処理

```typescript
useEffect(() => {
  if (timeRemaining <= 0) {
    setIsGameActive(false);
    
    // スコアをAsyncStorageに保存
    await AsyncStorage.setItem(
      'lastScore',
      JSON.stringify({
        score: score.totalScore,
        timestamp: Date.now(),
      })
    );

    // ハイスコア更新
    const highScore = await AsyncStorage.getItem('highScore');
    if (!highScore || score.totalScore > parseInt(highScore)) {
      await AsyncStorage.setItem('highScore', score.totalScore.toString());
    }
  }
}, [timeRemaining]);
```

---

## 6. 実装チェックリスト

タスクCの実装を完了するには、以下の項目を確認してください：

| 項目 | 状態 | 説明 |
|---|---|---|
| ボール型定義 | ✅ | `lib/types/ball.ts` で定義済み |
| ボール管理フック | ✅ | `hooks/use-ball-manager.ts` で実装済み |
| ボール描画 | ✅ | `components/ball-renderer.tsx` で実装済み |
| 放物線アニメーション | ✅ | 重力と速度で実装 |
| 衝突判定 | ✅ | 距離計算ベースの判定 |
| キック成功エフェクト | ✅ | パーティクルエフェクト実装 |
| スコア管理 | ✅ | コンボボーナス付き |
| ゲームループ | ⏳ | ゲーム画面への統合が必要 |
| 難易度設定 | ✅ | 3段階の難易度パラメータ |

---

## 7. 次のステップ

### 7.1 ゲーム画面への統合

1. `useBallManager`フックをゲーム画面に統合
2. `BallRenderer`コンポーネントをゲーム画面に追加
3. ゲームループにボール管理ロジックを統合

### 7.2 スコア永続化

1. AsyncStorageにスコアを保存
2. ハイスコア機能を実装
3. スコア履歴表示機能を追加

### 7.3 ビジュアル改善

1. Skiaを使用したボール描画の最適化
2. エフェクトアニメーションの調整
3. パーティクルシステムの実装

---

## 8. パフォーマンス考慮事項

### 8.1 フレームレート管理

```typescript
// 目標: 30fps
// 実装: setInterval(gameLoop, 33)
// 測定: React DevTools Profiler

const measureFrameRate = () => {
  let frameCount = 0;
  let lastTime = Date.now();

  const measureFrame = () => {
    frameCount++;
    const now = Date.now();
    if (now - lastTime >= 1000) {
      console.log(`FPS: ${frameCount}`);
      frameCount = 0;
      lastTime = now;
    }
    requestAnimationFrame(measureFrame);
  };

  measureFrame();
};
```

### 8.2 メモリ使用量最適化

```typescript
// ボール数の制限
const MAX_BALLS = 10;
if (balls.length > MAX_BALLS) {
  // 古いボールを削除
  setBalls((prev) => prev.slice(-MAX_BALLS));
}

// エフェクト数の制限
const MAX_EFFECTS = 20;
if (effects.length > MAX_EFFECTS) {
  setEffects((prev) => prev.slice(-MAX_EFFECTS));
}
```

---

## 9. トラブルシューティング

### 9.1 ボールが表示されない

**原因：** BallRendererコンポーネントがゲーム画面に追加されていない

**解決方法：**
```typescript
<GameCamera poseData={poseData} />
<BallRenderer balls={balls} effects={effects} />
```

### 9.2 衝突判定が機能しない

**原因：** 足首の座標が正しく取得されていない

**解決方法：**
```typescript
const ankleKeypoint = poseData?.landmarks[PoseLandmark.LEFT_ANKLE];
if (isKeypointValid(ankleKeypoint)) {
  checkCollision(ankleKeypoint);
}
```

### 9.3 フレームレートが低い

**原因：** ゲームループ内で重い処理を実行

**解決方法：**
- 衝突判定の最適化（空間分割など）
- エフェクト数の制限
- 不要なレンダリングの削除

---

## 参考資料

| リソース | URL |
|---------|-----|
| React Native Animated | https://reactnative.dev/docs/animated |
| react-native-reanimated | https://docs.swmansion.com/react-native-reanimated/ |
| Expo AsyncStorage | https://docs.expo.dev/versions/latest/sdk/async-storage/ |
