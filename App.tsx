import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

type Difficulty = "EASY" | "NORMAL" | "HARD";
type Screen = "home" | "rules" | "play" | "result" | "camera";
type BallType = "NORMAL" | "BLUE" | "GOLD";
type ShotResult = "PERFECT" | "GOOD" | "MISS" | "AVOID";
type CameraFacing = "front" | "back";
type RecognitionRange = "FULL_BODY" | "LOWER_BODY" | "FEET";

type Ball = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: BallType;
  spin: number;
};

type GameStats = {
  score: number;
  shots: number;
  hits: number;
  misses: number;
  avoided: number;
  combo: number;
  maxCombo: number;
  lastResult: ShotResult | null;
};

type PlayConfig = {
  label: string;
  timeLimit: number;
  spawnMs: number;
  speedMin: number;
  speedMax: number;
  gravity: number;
  ballMix: Record<BallType, number>;
  accent: string;
};

const configs: Record<Difficulty, PlayConfig> = {
  EASY: {
    label: "EASY",
    timeLimit: 45,
    spawnMs: 1500,
    speedMin: 3.4,
    speedMax: 4.6,
    gravity: 0.09,
    ballMix: { NORMAL: 88, BLUE: 7, GOLD: 5 },
    accent: "#47D16C",
  },
  NORMAL: {
    label: "NORMAL",
    timeLimit: 60,
    spawnMs: 1150,
    speedMin: 4.3,
    speedMax: 5.8,
    gravity: 0.12,
    ballMix: { NORMAL: 78, BLUE: 12, GOLD: 10 },
    accent: "#00D9FF",
  },
  HARD: {
    label: "HARD",
    timeLimit: 60,
    spawnMs: 850,
    speedMin: 5.4,
    speedMax: 7.0,
    gravity: 0.16,
    ballMix: { NORMAL: 68, BLUE: 17, GOLD: 15 },
    accent: "#FF6B6B",
  },
};

const initialStats: GameStats = {
  score: 0,
  shots: 0,
  hits: 0,
  misses: 0,
  avoided: 0,
  combo: 0,
  maxCombo: 0,
  lastResult: null,
};

const recognitionLabels: Record<RecognitionRange, { label: string; status: string; hint: string }> = {
  FULL_BODY: {
    label: "全身",
    status: "全身認識モード",
    hint: "フォーム分析まで使えます。距離が必要な場合は下半身へ切替できます。",
  },
  LOWER_BODY: {
    label: "下半身",
    status: "下半身認識モード",
    hint: "通常プレー推奨。腰、膝、足首が入ればキック判定に進めます。",
  },
  FEET: {
    label: "足元",
    status: "足元簡易モード",
    hint: "近い位置で遊ぶための簡易判定です。足首周辺が見えればOKです。",
  },
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pickBallType(config: PlayConfig): BallType {
  const roll = Math.random() * 100;
  if (roll < config.ballMix.NORMAL) return "NORMAL";
  if (roll < config.ballMix.NORMAL + config.ballMix.BLUE) return "BLUE";
  return "GOLD";
}

function ballPoints(type: BallType, result: ShotResult, combo: number) {
  if (result === "MISS") return -10;
  if (result === "AVOID") return 8;
  if (type === "BLUE") return -30;
  const base = type === "GOLD" ? 80 : 20;
  const quality = result === "PERFECT" ? 1.6 : 1;
  const comboBonus = Math.min(combo, 12) * 3;
  return Math.round(base * quality + comboBonus);
}

function resultLabel(result: ShotResult | null) {
  if (result === "PERFECT") return "PERFECT";
  if (result === "GOOD") return "GOOD";
  if (result === "AVOID") return "BLUE AVOID";
  if (result === "MISS") return "MISS";
  return "READY";
}

function rankFromStats(stats: GameStats) {
  const accuracy = stats.shots === 0 ? 0 : stats.hits / stats.shots;
  if (stats.score >= 900 && accuracy >= 0.85) return "S";
  if (stats.score >= 650 && accuracy >= 0.75) return "A";
  if (stats.score >= 420 && accuracy >= 0.6) return "B";
  if (stats.score >= 220) return "C";
  return "D";
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [difficulty, setDifficulty] = useState<Difficulty>("NORMAL");
  const [stats, setStats] = useState<GameStats>(initialStats);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [timeLeft, setTimeLeft] = useState(configs.NORMAL.timeLimit);
  const [fieldSize, setFieldSize] = useState({ width: 0, height: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [message, setMessage] = useState("タイミングを合わせてシュート");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("front");
  const [recognitionRange, setRecognitionRange] = useState<RecognitionRange>("LOWER_BODY");

  const ballIdRef = useRef(1);
  const lastTickRef = useRef(Date.now());
  const elapsedRef = useRef(0);
  const spawnElapsedRef = useRef(0);

  const config = configs[difficulty];
  const strikeZone = useMemo(() => {
    const width = fieldSize.width || 360;
    const height = fieldSize.height || 520;
    return {
      x: width * 0.5,
      y: height * 0.72,
      perfect: Math.min(width, height) * 0.13,
      good: Math.min(width, height) * 0.22,
    };
  }, [fieldSize]);

  const accuracy = stats.shots === 0 ? 0 : Math.round((stats.hits / stats.shots) * 100);

  const startGame = (nextDifficulty: Difficulty) => {
    const nextConfig = configs[nextDifficulty];
    setDifficulty(nextDifficulty);
    setStats(initialStats);
    setBalls([]);
    setTimeLeft(nextConfig.timeLimit);
    setIsPaused(false);
    setMessage("タイミングを合わせてシュート");
    elapsedRef.current = 0;
    spawnElapsedRef.current = nextConfig.spawnMs;
    lastTickRef.current = Date.now();
    ballIdRef.current = 1;
    setScreen("play");
  };

  const finishGame = () => {
    setBalls([]);
    setIsPaused(false);
    setScreen("result");
  };

  const spawnBall = () => {
    if (fieldSize.width <= 0 || fieldSize.height <= 0) return;
    const fromLeft = Math.random() > 0.5;
    const speed = randomBetween(config.speedMin, config.speedMax);
    const startY = randomBetween(fieldSize.height * 0.23, fieldSize.height * 0.42);
    const targetY = randomBetween(fieldSize.height * 0.58, fieldSize.height * 0.78);
    const targetX = fieldSize.width * randomBetween(0.38, 0.62);
    const startX = fromLeft ? -34 : fieldSize.width + 34;
    const distanceX = targetX - startX;
    const framesToTarget = Math.max(32, Math.abs(distanceX) / speed);
    const vx = distanceX / framesToTarget;
    const vy = (targetY - startY - config.gravity * framesToTarget * framesToTarget * 0.5) / framesToTarget;

    const type = pickBallType(config);

    setBalls((current) => [
      ...current,
      {
        id: ballIdRef.current++,
        x: startX,
        y: startY,
        vx,
        vy,
        radius: type === "GOLD" ? 18 : 16,
        type,
        spin: randomBetween(-5, 5),
      },
    ]);
  };

  useEffect(() => {
    if (screen !== "play") return;
    const timer = setInterval(() => {
      if (isPaused) {
        lastTickRef.current = Date.now();
        return;
      }

      const now = Date.now();
      const deltaMs = Math.min(80, now - lastTickRef.current);
      lastTickRef.current = now;
      elapsedRef.current += deltaMs;
      spawnElapsedRef.current += deltaMs;

      if (spawnElapsedRef.current >= config.spawnMs) {
        spawnElapsedRef.current = 0;
        spawnBall();
      }

      setTimeLeft((current) => {
        const next = Math.max(0, current - deltaMs / 1000);
        if (next <= 0.01) finishGame();
        return next;
      });

      setBalls((current) => {
        const step = deltaMs / 16.67;
        let missed = 0;
        let avoided = 0;
        const nextBalls = current
          .map((ball) => ({
            ...ball,
            x: ball.x + ball.vx * step,
            y: ball.y + ball.vy * step,
            vy: ball.vy + config.gravity * step,
            spin: ball.spin + 3 * step,
          }))
          .filter((ball) => {
            const stillVisible =
              ball.x > -70 &&
              ball.x < fieldSize.width + 70 &&
              ball.y > -70 &&
              ball.y < fieldSize.height + 90;
            if (!stillVisible && ball.type === "BLUE") avoided += 1;
            if (!stillVisible && ball.type !== "BLUE") missed += 1;
            return stillVisible;
          });

        if (missed > 0 || avoided > 0) {
          setStats((currentStats) => ({
            ...currentStats,
            misses: currentStats.misses + missed,
            avoided: currentStats.avoided + avoided,
            score: currentStats.score + avoided * ballPoints("BLUE", "AVOID", currentStats.combo),
            combo: missed > 0 ? 0 : currentStats.combo,
            lastResult: avoided > 0 ? "AVOID" : "MISS",
          }));
          setMessage(avoided > 0 ? "青ボール回避" : "ボールを見送りました");
        }

        return nextBalls;
      });
    }, 33);

    return () => clearInterval(timer);
  }, [config, fieldSize, isPaused, screen]);

  const shoot = () => {
    if (screen !== "play" || isPaused) return;

    const candidates = balls
      .map((ball) => {
        const dx = ball.x - strikeZone.x;
        const dy = ball.y - strikeZone.y;
        return { ball, distance: Math.sqrt(dx * dx + dy * dy) };
      })
      .sort((a, b) => a.distance - b.distance);

    const best = candidates[0];
    if (!best || best.distance > strikeZone.good) {
      setStats((current) => ({
        ...current,
        shots: current.shots + 1,
        misses: current.misses + 1,
        score: Math.max(0, current.score - 10),
        combo: 0,
        lastResult: "MISS",
      }));
      setMessage("空振り");
      return;
    }

    const result: ShotResult = best.distance <= strikeZone.perfect ? "PERFECT" : "GOOD";

    setBalls((current) => current.filter((ball) => ball.id !== best.ball.id));
    setStats((current) => {
      if (best.ball.type === "BLUE") {
        return {
          ...current,
          score: Math.max(0, current.score - 30),
          shots: current.shots + 1,
          misses: current.misses + 1,
          combo: 0,
          lastResult: "MISS",
        };
      }

      const nextCombo = current.combo + 1;
      const points = ballPoints(best.ball.type, result, nextCombo);
      return {
        ...current,
        score: Math.max(0, current.score + points),
        shots: current.shots + 1,
        hits: current.hits + 1,
        combo: nextCombo,
        maxCombo: Math.max(current.maxCombo, nextCombo),
        lastResult: result,
      };
    });
    setMessage(best.ball.type === "BLUE" ? "青ボールを蹴って減点" : `${resultLabel(result)} SHOT`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        {screen === "home" && (
          <ScrollView contentContainerStyle={styles.homeContent}>
            <View style={styles.hero}>
              <Text style={styles.title}>ボレーシュート</Text>
              <Text style={styles.subtitle}>チャレンジ</Text>
              <Text style={styles.caption}>VOLLEY SHOOT CHALLENGE</Text>
            </View>

            <Text style={styles.description}>
              飛んでくるボールがキックゾーンに重なった瞬間にシュート。金色は高得点、青色は蹴らずに回避します。
            </Text>

            <Text style={styles.sectionTitle}>難易度</Text>
            {(["EASY", "NORMAL", "HARD"] as Difficulty[]).map((item) => (
              <Pressable
                key={item}
                style={({ pressed }) => [
                  styles.difficultyButton,
                  { borderColor: configs[item].accent },
                  pressed && styles.pressed,
                ]}
                onPress={() => startGame(item)}
              >
                <View>
                  <Text style={styles.difficultyText}>{configs[item].label}</Text>
                  <Text style={styles.difficultyHint}>
                    {item === "EASY"
                      ? "ゆっくり狙える入門モード"
                      : item === "NORMAL"
                        ? "標準スピードの実戦モード"
                        : "反応速度を試す高負荷モード"}
                  </Text>
                </View>
                <Text style={[styles.difficultyMeta, { color: configs[item].accent }]}>
                  {configs[item].timeLimit}s
                </Text>
              </Pressable>
            ))}

            <Pressable style={styles.secondaryButton} onPress={() => setScreen("rules")}>
              <Text style={styles.secondaryText}>ルールを見る</Text>
            </Pressable>

            <Pressable style={styles.cameraButton} onPress={() => setScreen("camera")}>
              <Text style={styles.cameraButtonText}>カメラ診断</Text>
            </Pressable>
          </ScrollView>
        )}

        {screen === "rules" && (
          <ScrollView contentContainerStyle={styles.homeContent}>
            <Text style={styles.titleSmall}>ゲームルール</Text>
            <Text style={styles.ruleText}>1. 下部のキックゾーンにボールが入った瞬間に SHOT を押します。</Text>
            <Text style={styles.ruleText}>2. 白いボールは通常得点、金色ボールは高得点です。</Text>
            <Text style={styles.ruleText}>3. 青いボールは減点ボールなので、キックせず見送ると回避点が入ります。</Text>
            <Text style={styles.ruleText}>4. 連続成功でコンボボーナスが伸びます。</Text>
            <Pressable style={styles.secondaryButton} onPress={() => setScreen("home")}>
              <Text style={styles.secondaryText}>戻る</Text>
            </Pressable>
          </ScrollView>
        )}

        {screen === "camera" && (
          <View style={styles.cameraRoot}>
            <View style={styles.cameraHeader}>
              <View>
                <Text style={styles.cameraTitle}>カメラ診断</Text>
                <Text style={styles.cameraStatus}>
                  {cameraPermission?.granted
                    ? recognitionLabels[recognitionRange].status
                    : cameraPermission?.canAskAgain === false
                      ? "設定アプリでカメラ許可が必要です"
                      : "カメラ許可を確認します"}
                </Text>
              </View>
              <Pressable style={styles.headerButton} onPress={() => setScreen("home")}>
                <Text style={styles.headerButtonText}>戻る</Text>
              </Pressable>
            </View>

            <View style={styles.cameraPreviewFrame}>
              {cameraPermission?.granted ? (
                <CameraView style={styles.cameraPreview} facing={cameraFacing}>
                  <View style={styles.cameraOverlay}>
                    {recognitionRange === "FULL_BODY" && (
                      <>
                        <View style={styles.poseGuideHead} />
                        <View style={styles.poseGuideBody} />
                        <View style={styles.poseGuideLegLeft} />
                        <View style={styles.poseGuideLegRight} />
                      </>
                    )}
                    {recognitionRange === "LOWER_BODY" && (
                      <>
                        <View style={styles.lowerBodyWaistLine} />
                        <View style={styles.lowerBodyGuide} />
                        <View style={styles.lowerLegLeft} />
                        <View style={styles.lowerLegRight} />
                      </>
                    )}
                    {recognitionRange === "FEET" && (
                      <>
                        <View style={styles.feetGuideLeft} />
                        <View style={styles.feetGuideRight} />
                        <View style={styles.feetStrikeLine} />
                      </>
                    )}
                    <Text style={styles.cameraOverlayText}>{recognitionLabels[recognitionRange].hint}</Text>
                  </View>
                </CameraView>
              ) : (
                <View style={styles.permissionPanel}>
                  <Text style={styles.permissionTitle}>カメラを使う準備</Text>
                  <Text style={styles.permissionText}>
                    次の段階で足の動きからキック判定を行うため、まずプレビュー表示だけを確認します。
                  </Text>
                  <Pressable style={styles.primaryButton} onPress={requestCameraPermission}>
                    <Text style={styles.primaryText}>カメラを許可</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.cameraFooter}>
              <View style={styles.cameraControlRow}>
                <Pressable
                  style={[styles.cameraToggleButton, cameraFacing === "front" && styles.cameraToggleActive]}
                  onPress={() => setCameraFacing("front")}
                >
                  <Text
                    style={[
                      styles.cameraToggleText,
                      cameraFacing === "front" && styles.cameraToggleTextActive,
                    ]}
                  >
                    前面
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.cameraToggleButton, cameraFacing === "back" && styles.cameraToggleActive]}
                  onPress={() => setCameraFacing("back")}
                >
                  <Text
                    style={[
                      styles.cameraToggleText,
                      cameraFacing === "back" && styles.cameraToggleTextActive,
                    ]}
                  >
                    背面
                  </Text>
                </Pressable>
              </View>

              <View style={styles.recognitionTabs}>
                {(["FULL_BODY", "LOWER_BODY", "FEET"] as RecognitionRange[]).map((item) => (
                  <Pressable
                    key={item}
                    style={[
                      styles.recognitionTab,
                      recognitionRange === item && styles.recognitionTabActive,
                    ]}
                    onPress={() => setRecognitionRange(item)}
                  >
                    <Text
                      style={[
                        styles.recognitionTabText,
                        recognitionRange === item && styles.recognitionTabTextActive,
                      ]}
                    >
                      {recognitionLabels[item].label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.cameraHint}>
                通常プレーは下半身で十分です。全身はフォーム分析、足元は近距離プレー用です。
              </Text>
            </View>
          </View>
        )}

        {screen === "play" && (
          <View style={styles.playRoot}>
            <View style={styles.hud}>
              <View style={styles.hudItem}>
                <Text style={styles.hudLabel}>SCORE</Text>
                <Text style={styles.hudValue}>{stats.score}</Text>
              </View>
              <View style={styles.hudItem}>
                <Text style={styles.hudLabel}>TIME</Text>
                <Text style={[styles.hudValue, timeLeft < 10 && styles.warningText]}>
                  {Math.ceil(timeLeft)}
                </Text>
              </View>
              <View style={styles.hudItem}>
                <Text style={styles.hudLabel}>COMBO</Text>
                <Text style={styles.hudValue}>{stats.combo}</Text>
              </View>
            </View>

            <Pressable
              style={styles.field}
              onPress={shoot}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setFieldSize({ width, height });
              }}
            >
              <View
                style={[
                  styles.strikeZone,
                  {
                    left: strikeZone.x - strikeZone.good,
                    top: strikeZone.y - strikeZone.good,
                    width: strikeZone.good * 2,
                    height: strikeZone.good * 2,
                    borderRadius: strikeZone.good,
                  },
                ]}
              />
              <View
                style={[
                  styles.perfectZone,
                  {
                    left: strikeZone.x - strikeZone.perfect,
                    top: strikeZone.y - strikeZone.perfect,
                    width: strikeZone.perfect * 2,
                    height: strikeZone.perfect * 2,
                    borderRadius: strikeZone.perfect,
                  },
                ]}
              />
              <View style={styles.goal}>
                <View style={styles.goalNet} />
                <Text style={styles.goalText}>GOAL</Text>
              </View>

              {balls.map((ball) => (
                <View
                  key={ball.id}
                  style={[
                    styles.ball,
                    ball.type === "BLUE" && styles.blueBall,
                    ball.type === "GOLD" && styles.goldBall,
                    {
                      left: ball.x - ball.radius,
                      top: ball.y - ball.radius,
                      width: ball.radius * 2,
                      height: ball.radius * 2,
                      borderRadius: ball.radius,
                      transform: [{ rotate: `${ball.spin}deg` }],
                    },
                  ]}
                >
                  <View style={styles.ballPatch} />
                </View>
              ))}

              {isPaused && (
                <View style={styles.pauseOverlay}>
                  <Text style={styles.pauseText}>PAUSED</Text>
                </View>
              )}
            </Pressable>

            <View style={styles.playFooter}>
              <Text style={styles.messageText}>{message}</Text>
              <Text style={styles.subStats}>
                命中 {stats.hits} / シュート {stats.shots} / 精度 {accuracy}% / 最大 {stats.maxCombo} combo
              </Text>
              <View style={styles.controls}>
                <Pressable style={styles.controlButton} onPress={() => setIsPaused((value) => !value)}>
                  <Text style={styles.controlText}>{isPaused ? "再開" : "一時停止"}</Text>
                </Pressable>
                <Pressable style={styles.shotButton} onPress={shoot}>
                  <Text style={styles.shotText}>SHOT</Text>
                </Pressable>
                <Pressable style={styles.controlButton} onPress={finishGame}>
                  <Text style={styles.controlText}>終了</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {screen === "result" && (
          <ScrollView contentContainerStyle={styles.resultContent}>
            <Text style={styles.titleSmall}>RESULT</Text>
            <View style={styles.rankPanel}>
              <Text style={styles.rankLabel}>RANK</Text>
              <Text style={[styles.rankValue, { color: config.accent }]}>{rankFromStats(stats)}</Text>
            </View>
            <View style={styles.resultGrid}>
              <ResultCard label="スコア" value={stats.score.toString()} />
              <ResultCard label="命中率" value={`${accuracy}%`} />
              <ResultCard label="命中" value={stats.hits.toString()} />
              <ResultCard label="ミス" value={stats.misses.toString()} />
              <ResultCard label="青回避" value={stats.avoided.toString()} />
              <ResultCard label="最大コンボ" value={stats.maxCombo.toString()} />
            </View>
            <Pressable style={styles.primaryButton} onPress={() => startGame(difficulty)}>
              <Text style={styles.primaryText}>もう一度プレイ</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setScreen("home")}>
              <Text style={styles.secondaryText}>ホームへ</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#08111F",
  },
  root: {
    flex: 1,
    backgroundColor: "#08111F",
  },
  homeContent: {
    padding: 22,
    gap: 16,
  },
  hero: {
    paddingVertical: 26,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#102C3C",
    borderWidth: 1,
    borderColor: "rgba(0, 217, 255, 0.35)",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
  },
  subtitle: {
    color: "#00D9FF",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 2,
  },
  caption: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    marginTop: 12,
  },
  titleSmall: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
  },
  description: {
    color: "#C9D6E2",
    fontSize: 15,
    lineHeight: 24,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  difficultyButton: {
    minHeight: 78,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.055)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  pressed: {
    opacity: 0.72,
  },
  difficultyText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  difficultyHint: {
    color: "#AAB7C4",
    fontSize: 13,
    marginTop: 6,
  },
  difficultyMeta: {
    fontSize: 20,
    fontWeight: "900",
  },
  primaryButton: {
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#00D9FF",
    marginTop: 10,
  },
  primaryText: {
    color: "#08111F",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "rgba(0,217,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(0,217,255,0.32)",
    marginTop: 8,
  },
  secondaryText: {
    color: "#00D9FF",
    fontSize: 16,
    fontWeight: "700",
  },
  cameraButton: {
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "rgba(71,209,108,0.14)",
    borderWidth: 1,
    borderColor: "rgba(71,209,108,0.36)",
  },
  cameraButtonText: {
    color: "#47D16C",
    fontSize: 16,
    fontWeight: "800",
  },
  ruleText: {
    color: "#C9D6E2",
    fontSize: 16,
    lineHeight: 26,
  },
  cameraRoot: {
    flex: 1,
    backgroundColor: "#08111F",
  },
  cameraHeader: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cameraTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  cameraStatus: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 4,
  },
  headerButton: {
    minWidth: 72,
    minHeight: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  headerButtonText: {
    color: "#DCE7F3",
    fontSize: 14,
    fontWeight: "800",
  },
  cameraPreviewFrame: {
    flex: 1,
    margin: 12,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#050A12",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cameraPreview: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  poseGuideHead: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: "rgba(0,217,255,0.78)",
    marginBottom: 8,
  },
  poseGuideBody: {
    width: 120,
    height: 150,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(0,217,255,0.72)",
  },
  poseGuideLegLeft: {
    position: "absolute",
    bottom: 82,
    width: 2,
    height: 92,
    backgroundColor: "rgba(0,217,255,0.72)",
    transform: [{ translateX: -28 }, { rotate: "12deg" }],
  },
  poseGuideLegRight: {
    position: "absolute",
    bottom: 82,
    width: 2,
    height: 92,
    backgroundColor: "rgba(0,217,255,0.72)",
    transform: [{ translateX: 28 }, { rotate: "-12deg" }],
  },
  lowerBodyWaistLine: {
    position: "absolute",
    top: "22%",
    left: "22%",
    right: "22%",
    height: 2,
    backgroundColor: "rgba(71,209,108,0.9)",
  },
  lowerBodyGuide: {
    position: "absolute",
    top: "22%",
    bottom: "13%",
    width: "42%",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(71,209,108,0.82)",
    backgroundColor: "rgba(71,209,108,0.08)",
  },
  lowerLegLeft: {
    position: "absolute",
    bottom: "14%",
    width: 3,
    height: "37%",
    backgroundColor: "rgba(71,209,108,0.82)",
    transform: [{ translateX: -34 }, { rotate: "9deg" }],
  },
  lowerLegRight: {
    position: "absolute",
    bottom: "14%",
    width: 3,
    height: "37%",
    backgroundColor: "rgba(71,209,108,0.82)",
    transform: [{ translateX: 34 }, { rotate: "-9deg" }],
  },
  feetGuideLeft: {
    position: "absolute",
    bottom: "26%",
    width: 92,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: "rgba(250,204,21,0.9)",
    backgroundColor: "rgba(250,204,21,0.1)",
    transform: [{ translateX: -58 }, { rotate: "8deg" }],
  },
  feetGuideRight: {
    position: "absolute",
    bottom: "26%",
    width: 92,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: "rgba(250,204,21,0.9)",
    backgroundColor: "rgba(250,204,21,0.1)",
    transform: [{ translateX: 58 }, { rotate: "-8deg" }],
  },
  feetStrikeLine: {
    position: "absolute",
    bottom: "19%",
    left: "18%",
    right: "18%",
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(250,204,21,0.9)",
  },
  cameraOverlayText: {
    position: "absolute",
    bottom: 20,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    backgroundColor: "rgba(8,17,31,0.72)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  permissionPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  permissionTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 10,
  },
  permissionText: {
    color: "#C9D6E2",
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 16,
  },
  cameraFooter: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 10,
  },
  cameraControlRow: {
    flexDirection: "row",
    gap: 8,
  },
  cameraToggleButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cameraToggleActive: {
    backgroundColor: "rgba(0,217,255,0.18)",
    borderColor: "rgba(0,217,255,0.55)",
  },
  cameraToggleText: {
    color: "#DCE7F3",
    fontSize: 14,
    fontWeight: "800",
  },
  cameraToggleTextActive: {
    color: "#00D9FF",
  },
  recognitionTabs: {
    flexDirection: "row",
    gap: 8,
  },
  recognitionTab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  recognitionTabActive: {
    backgroundColor: "rgba(71,209,108,0.18)",
    borderColor: "rgba(71,209,108,0.55)",
  },
  recognitionTabText: {
    color: "#DCE7F3",
    fontSize: 13,
    fontWeight: "900",
  },
  recognitionTabTextActive: {
    color: "#47D16C",
  },
  cameraHint: {
    color: "#94A3B8",
    fontSize: 12,
    textAlign: "center",
  },
  playRoot: {
    flex: 1,
  },
  hud: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  hudItem: {
    flex: 1,
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.065)",
    alignItems: "center",
    justifyContent: "center",
  },
  hudLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
  },
  hudValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 3,
  },
  warningText: {
    color: "#FF6B6B",
  },
  field: {
    flex: 1,
    backgroundColor: "#0F5A3B",
    overflow: "hidden",
  },
  goal: {
    position: "absolute",
    top: 24,
    left: "22%",
    right: "22%",
    height: 78,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },
  goalNet: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  goalText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "900",
  },
  strikeZone: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  perfectZone: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#00D9FF",
    backgroundColor: "rgba(0,217,255,0.14)",
  },
  ball: {
    position: "absolute",
    backgroundColor: "#F8FAFC",
    borderWidth: 2,
    borderColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  blueBall: {
    backgroundColor: "#38BDF8",
    borderColor: "#075985",
  },
  goldBall: {
    backgroundColor: "#FACC15",
    borderColor: "#A16207",
  },
  ballPatch: {
    width: "36%",
    height: "36%",
    borderRadius: 2,
    backgroundColor: "rgba(15,23,42,0.75)",
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,17,31,0.68)",
  },
  pauseText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
  },
  playFooter: {
    padding: 12,
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#08111F",
  },
  messageText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  subStats: {
    color: "#94A3B8",
    fontSize: 12,
    textAlign: "center",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  controlButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  controlText: {
    color: "#DCE7F3",
    fontSize: 14,
    fontWeight: "800",
  },
  shotButton: {
    flex: 1.45,
    minHeight: 62,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00D9FF",
  },
  shotText: {
    color: "#08111F",
    fontSize: 24,
    fontWeight: "900",
  },
  resultContent: {
    padding: 22,
    gap: 16,
  },
  rankPanel: {
    minHeight: 150,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.065)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  rankLabel: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "800",
  },
  rankValue: {
    fontSize: 72,
    fontWeight: "900",
    marginTop: 4,
  },
  resultGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  resultCard: {
    width: "48%",
    minHeight: 82,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.065)",
    padding: 14,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  resultLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
  },
  resultValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 6,
  },
});
