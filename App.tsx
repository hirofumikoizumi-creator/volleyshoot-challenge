import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ImageBackground,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { OnDeviceVolleyCamera } from "./components/OnDeviceVolleyCamera";

type Difficulty = "EASY" | "NORMAL" | "HARD";
type Screen = "home" | "rules" | "play" | "result" | "camera" | "cameraPlay";
type BallType = "NORMAL" | "BLUE" | "GOLD";
type ShotResult = "PERFECT" | "GOOD" | "MISS" | "AVOID";
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

type FootTracker = {
  x: number;
  y: number;
  speed: number;
  ready: boolean;
  lastTs: number;
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

const initialFootTracker: FootTracker = {
  x: 180,
  y: 380,
  speed: 0,
  ready: false,
  lastTs: 0,
};
const blazePoseLiteModel = require("./assets/models/blazepose_lite.tflite");

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function recognitionScale(range: RecognitionRange) {
  if (range === "FULL_BODY") return 0.72;
  if (range === "FEET") return 1.34;
  return 1;
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
  const [recognitionRange, setRecognitionRange] = useState<RecognitionRange>("LOWER_BODY");
  const [footTracker, setFootTracker] = useState<FootTracker>(initialFootTracker);

  const ballIdRef = useRef(1);
  const lastTickRef = useRef(Date.now());
  const elapsedRef = useRef(0);
  const spawnElapsedRef = useRef(0);
  const footTrackerRef = useRef<FootTracker>(initialFootTracker);
  const lastAutoKickRef = useRef(0);

  const config = configs[difficulty];
  const bodyScale = screen === "cameraPlay" ? recognitionScale(recognitionRange) : 1;
  const footReach = useMemo(() => {
    const base = Math.min(fieldSize.width || 360, fieldSize.height || 520);
    return {
      perfect: base * (0.055 + bodyScale * 0.018),
      good: base * (0.1 + bodyScale * 0.028),
      marker: base * (0.035 + bodyScale * 0.014),
    };
  }, [bodyScale, fieldSize]);
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

  useEffect(() => {
    if (fieldSize.width <= 0 || fieldSize.height <= 0 || footTracker.ready) return;
    const next = {
      ...footTrackerRef.current,
      x: fieldSize.width * 0.5,
      y: fieldSize.height * 0.76,
      ready: true,
    };
    footTrackerRef.current = next;
    setFootTracker(next);
  }, [fieldSize, footTracker.ready]);

  const resetSession = (nextDifficulty: Difficulty, nextMessage: string) => {
    const nextConfig = configs[nextDifficulty];
    setDifficulty(nextDifficulty);
    setStats(initialStats);
    setBalls([]);
    setTimeLeft(nextConfig.timeLimit);
    setIsPaused(false);
    setMessage(nextMessage);
    setFootTracker(initialFootTracker);
    footTrackerRef.current = initialFootTracker;
    elapsedRef.current = 0;
    spawnElapsedRef.current = nextConfig.spawnMs;
    lastTickRef.current = Date.now();
    ballIdRef.current = 1;
  };

  const startGame = async (nextDifficulty: Difficulty) => {
    resetSession(nextDifficulty, "カメラに映る足をボールへ振り抜くと自動判定");
    if (!cameraPermission?.granted && cameraPermission?.canAskAgain !== false) {
      await requestCameraPermission();
    }
    setScreen("cameraPlay");
  };

  const startCameraGame = async () => {
    resetSession(difficulty, "足をボールへ振り抜くと自動判定");
    if (!cameraPermission?.granted && cameraPermission?.canAskAgain !== false) {
      await requestCameraPermission();
    }
    const nextFoot = {
      ...initialFootTracker,
      x: fieldSize.width > 0 ? fieldSize.width * 0.5 : initialFootTracker.x,
      y: fieldSize.height > 0 ? fieldSize.height * 0.76 : initialFootTracker.y,
      ready: fieldSize.width > 0 && fieldSize.height > 0,
    };
    footTrackerRef.current = nextFoot;
    setFootTracker(nextFoot);
    setScreen("cameraPlay");
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
    const isCameraVolley = screen === "cameraPlay";
    const startY = randomBetween(fieldSize.height * 0.18, fieldSize.height * 0.46);
    const targetY = randomBetween(
      fieldSize.height * (isCameraVolley ? 0.3 : 0.58),
      fieldSize.height * (isCameraVolley ? 0.82 : 0.78),
    );
    const targetX = fieldSize.width * randomBetween(isCameraVolley ? 0.16 : 0.38, isCameraVolley ? 0.84 : 0.62);
    const startX = fromLeft ? -34 : fieldSize.width + 34;
    const distanceX = targetX - startX;
    const framesToTarget = Math.max(32, Math.abs(distanceX) / speed);
    const vx = distanceX / framesToTarget;
    const vy = (targetY - startY - config.gravity * framesToTarget * framesToTarget * 0.5) / framesToTarget;

    const type = pickBallType(config);
    const baseRadius = type === "GOLD" ? 18 : 16;

    setBalls((current) => [
      ...current,
      {
        id: ballIdRef.current++,
        x: startX,
        y: startY,
        vx,
        vy,
        radius: Math.round(baseRadius * bodyScale),
        type,
        spin: randomBetween(-5, 5),
      },
    ]);
  };

  useEffect(() => {
    if (screen !== "play" && screen !== "cameraPlay") return;
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

  const shootAt = (anchor: { x: number; y: number }, goodReach: number, perfectReach: number, source: "button" | "foot") => {
    if ((screen !== "play" && screen !== "cameraPlay") || isPaused) return;

    const candidates = balls
      .map((ball) => {
        const dx = ball.x - anchor.x;
        const dy = ball.y - anchor.y;
        const centerDistance = Math.sqrt(dx * dx + dy * dy);
        return { ball, distance: Math.max(0, centerDistance - ball.radius) };
      })
      .sort((a, b) => a.distance - b.distance);

    const best = candidates[0];
    if (!best || best.distance > goodReach) {
      setStats((current) => ({
        ...current,
        shots: current.shots + 1,
        misses: current.misses + 1,
        score: Math.max(0, current.score - 10),
        combo: 0,
        lastResult: "MISS",
      }));
      setMessage(source === "foot" ? "足は振れています。ボールに近づけて" : "空振り");
      return;
    }

    const result: ShotResult = best.distance <= perfectReach ? "PERFECT" : "GOOD";

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
    setMessage(best.ball.type === "BLUE" ? "青ボールを蹴って減点" : `${resultLabel(result)} VOLLEY`);
  };

  const shoot = () => {
    if (screen === "cameraPlay") {
      const anchor = footTracker.ready ? footTracker : { x: fieldSize.width * 0.5, y: fieldSize.height * 0.76 };
      shootAt(anchor, footReach.good, footReach.perfect, "button");
      return;
    }
    shootAt(strikeZone, strikeZone.good, strikeZone.perfect, "button");
  };

  const registerFootPosition = (x: number, y: number) => {
    const now = Date.now();
    const previous = footTrackerRef.current;
    const elapsed = Math.max(16, now - (previous.lastTs || now - 16));
    const dx = x - previous.x;
    const dy = y - previous.y;
    const speed = Math.sqrt(dx * dx + dy * dy) / elapsed;
    const next = { x, y, speed, ready: true, lastTs: now };
    footTrackerRef.current = next;
    setFootTracker(next);

    if (screen === "cameraPlay" && speed > 0.72 && now - lastAutoKickRef.current > 220) {
      lastAutoKickRef.current = now;
      shootAt(next, footReach.good, footReach.perfect, "foot");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        {screen === "home" && (
          <ScrollView contentContainerStyle={styles.homeContent}>
            <View style={styles.hero}>
              <View style={styles.stadiumLights}>
                <View style={styles.lightBeam} />
                <View style={[styles.lightBeam, styles.lightBeamRight]} />
              </View>
              <View style={styles.heroAction}>
                <View style={styles.motionTrail} />
                <View style={styles.heroLeg} />
                <View style={styles.heroBoot} />
                <View style={styles.heroBall}>
                  <View style={styles.heroBallPatch} />
                </View>
              </View>
              <ImageBackground
                source={require("./assets/images/icon.png")}
                style={styles.heroImage}
                imageStyle={styles.heroImageAsset}
              >
                <View style={styles.heroShade} />
                <View style={styles.titlePlate}>
                  <Text style={styles.titleKicker}>REAL CAMERA FOOTBALL</Text>
                  <Text style={styles.titleJa}>ボレーシュートチャレンジ</Text>
                  <Text style={styles.title}>－Volley Shoot Challenge－</Text>
                  <Text style={styles.caption}>空中の一瞬を、足で撃ち抜け。</Text>
                </View>
              </ImageBackground>
            </View>

            <Text style={styles.description}>
              飛んでくるボールを自由に足で捉える、ボレーシュート特化の反応トレーニング。カメラプレイでは足元トラッカーで空中ボールへの接触を判定します。
            </Text>

            <Text style={styles.sectionTitle}>TRAINING MODE</Text>
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
                <View style={styles.difficultyGlow} />
                <View style={styles.difficultyIcon}>
                  <Text style={styles.difficultyIconText}>
                    {item === "EASY" ? "1" : item === "NORMAL" ? "2" : "3"}
                  </Text>
                </View>
                <View style={styles.difficultyCopy}>
                  <Text style={styles.difficultyText}>{configs[item].label}</Text>
                  <Text style={styles.difficultyHint}>
                    {item === "EASY"
                      ? "フォーム確認と初回トレーニング"
                      : item === "NORMAL"
                        ? "実戦テンポのボレー反応"
                        : "高速クロスへの一撃勝負"}
                  </Text>
                </View>
                <View style={styles.difficultyMetaPanel}>
                  <Text style={[styles.difficultyMeta, { color: configs[item].accent }]}>
                    {configs[item].timeLimit}s
                  </Text>
                  <Text style={styles.difficultyMetaLabel}>SESSION</Text>
                </View>
              </Pressable>
            ))}

            <Pressable style={styles.secondaryButton} onPress={() => setScreen("rules")}>
              <Text style={styles.secondaryText}>ルールを見る</Text>
            </Pressable>

            <Pressable style={styles.cameraButton} onPress={() => setScreen("camera")}>
              <Text style={styles.cameraButtonText}>カメラプレイ準備</Text>
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
                <CameraView style={styles.cameraPreview} facing="front">
                  <View style={styles.cameraOverlay}>
                    <View style={styles.cameraFloatingTop}>
                      <Text style={styles.cameraFloatingStatus}>
                        {recognitionLabels[recognitionRange].status}
                      </Text>
                    </View>

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

                    <View style={styles.cameraFloatingControls}>
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
              <Text style={styles.cameraHint}>
                通常プレーは下半身で十分です。全身はフォーム分析、足元は近距離プレー用です。
              </Text>
              {cameraPermission?.granted && (
                <Pressable style={styles.cameraStartButton} onPress={startCameraGame}>
                  <Text style={styles.cameraStartText}>この画面でプレー開始</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {screen === "cameraPlay" && (
          <View style={styles.cameraPlayRoot}>
            <View
              style={styles.cameraPlayField}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setFieldSize({ width, height });
              }}
            >
              {fieldSize.width > 0 && fieldSize.height > 0 ? (
                <OnDeviceVolleyCamera
                  width={fieldSize.width}
                  height={fieldSize.height}
                  modelAsset={blazePoseLiteModel}
                  onFootDetected={(point) => registerFootPosition(point.x, point.y)}
                />
              ) : (
                <CameraView style={styles.cameraPlayPreview} facing="front" />
              )}
              <Pressable style={styles.cameraPlayOverlay} onPress={shoot}>
                <View style={styles.cameraPlayHud}>
                  <Text style={styles.cameraPlayHudText}>SCORE {stats.score}</Text>
                  <Text style={[styles.cameraPlayHudText, timeLeft < 10 && styles.warningText]}>
                    TIME {Math.ceil(timeLeft)}
                  </Text>
                  <Text style={styles.cameraPlayHudText}>COMBO {stats.combo}</Text>
                </View>

                <View style={styles.volleyLane} />
                <View
                  style={[
                    styles.footReachZone,
                    {
                      left: footTracker.x - footReach.good,
                      top: footTracker.y - footReach.good,
                      width: footReach.good * 2,
                      height: footReach.good * 2,
                      borderRadius: footReach.good,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.footMarker,
                    {
                      left: footTracker.x - footReach.marker,
                      top: footTracker.y - footReach.marker,
                      width: footReach.marker * 2,
                      height: footReach.marker * 1.18,
                      borderRadius: footReach.marker,
                      transform: [{ rotate: `${Math.max(-34, Math.min(34, footTracker.speed * 18))}deg` }],
                    },
                  ]}
                >
                  <Text style={styles.footMarkerText}>FOOT</Text>
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

                <Text style={styles.cameraPlayMessage}>
                  {message} / {recognitionLabels[recognitionRange].label} x{bodyScale.toFixed(2)}
                </Text>

                <View style={styles.cameraPlayControls}>
                  <Pressable style={styles.cameraPlayMiniButton} onPress={() => setIsPaused((value) => !value)}>
                    <Text style={styles.cameraPlayMiniText}>{isPaused ? "再開" : "停止"}</Text>
                  </Pressable>
                  <Pressable style={styles.cameraPlayShotButton} onPress={shoot}>
                    <Text style={styles.cameraPlayShotText}>SHOT</Text>
                  </Pressable>
                  <Pressable style={styles.cameraPlayMiniButton} onPress={finishGame}>
                    <Text style={styles.cameraPlayMiniText}>終了</Text>
                  </Pressable>
                </View>

                {isPaused && (
                  <View style={styles.pauseOverlay}>
                    <Text style={styles.pauseText}>PAUSED</Text>
                  </View>
                )}
              </Pressable>
              <View
                style={styles.footTouchLayer}
                onTouchStart={(event) => {
                  const touch = event.nativeEvent;
                  registerFootPosition(touch.locationX, touch.locationY);
                }}
                onTouchMove={(event) => {
                  const touch = event.nativeEvent;
                  registerFootPosition(touch.locationX, touch.locationY);
                }}
              />
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
    padding: 18,
    gap: 14,
    backgroundColor: "#030811",
  },
  hero: {
    minHeight: 288,
    padding: 0,
    borderRadius: 8,
    backgroundColor: "#030811",
    borderWidth: 1,
    borderColor: "rgba(0, 217, 255, 0.58)",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  stadiumLights: {
    ...StyleSheet.absoluteFillObject,
  },
  lightBeam: {
    position: "absolute",
    top: -56,
    left: 14,
    width: 170,
    height: 250,
    backgroundColor: "rgba(0,217,255,0.18)",
    transform: [{ rotate: "28deg" }],
  },
  lightBeamRight: {
    left: undefined,
    right: 22,
    backgroundColor: "rgba(145,255,0,0.13)",
    transform: [{ rotate: "-26deg" }],
  },
  heroAction: {
    position: "absolute",
    top: 12,
    right: 16,
    width: 250,
    height: 180,
    opacity: 0.72,
  },
  heroImage: {
    flex: 1,
    minHeight: 288,
    justifyContent: "flex-end",
  },
  heroImageAsset: {
    opacity: 0.82,
    transform: [{ scale: 1.08 }],
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,16,0.32)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(145,255,0,0.26)",
  },
  titlePlate: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 42,
    paddingBottom: 20,
    backgroundColor: "rgba(3,8,17,0.62)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.16)",
  },
  titleKicker: {
    color: "#A3FF12",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 5,
    textAlign: "center",
  },
  motionTrail: {
    position: "absolute",
    left: 8,
    top: 102,
    width: 190,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(0,217,255,0.78)",
    transform: [{ rotate: "-24deg" }],
  },
  heroLeg: {
    position: "absolute",
    left: 38,
    bottom: 18,
    width: 118,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 3,
    borderColor: "#08111F",
    transform: [{ rotate: "-38deg" }],
  },
  heroBoot: {
    position: "absolute",
    left: 126,
    bottom: 65,
    width: 68,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#08111F",
    borderWidth: 2,
    borderColor: "#00D9FF",
    transform: [{ rotate: "18deg" }],
  },
  heroBall: {
    position: "absolute",
    right: 10,
    top: 18,
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#F8FAFC",
    borderWidth: 4,
    borderColor: "#08111F",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBallPatch: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "#08111F",
    transform: [{ rotate: "18deg" }],
  },
  title: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 31,
    textAlign: "center",
  },
  titleJa: {
    color: "#00D9FF",
    fontSize: 29,
    fontWeight: "900",
    lineHeight: 36,
    textAlign: "center",
  },
  subtitle: {
    color: "#00D9FF",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 0,
  },
  caption: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
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
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: 14,
  },
  sectionTitle: {
    color: "#A3FF12",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 8,
    textAlign: "center",
  },
  difficultyButton: {
    minHeight: 86,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(2,8,18,0.96)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
  difficultyGlow: {
    position: "absolute",
    top: -28,
    right: -16,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: "rgba(0,217,255,0.12)",
  },
  difficultyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(163,255,18,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.42)",
  },
  difficultyIconText: {
    color: "#A3FF12",
    fontSize: 20,
    fontWeight: "900",
  },
  difficultyCopy: {
    flex: 1,
  },
  pressed: {
    opacity: 0.72,
  },
  difficultyText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  difficultyHint: {
    color: "#AAB7C4",
    fontSize: 13,
    marginTop: 6,
  },
  difficultyMetaPanel: {
    minWidth: 66,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  difficultyMeta: {
    fontSize: 20,
    fontWeight: "900",
  },
  difficultyMetaLabel: {
    color: "#94A3B8",
    fontSize: 9,
    fontWeight: "900",
    marginTop: 2,
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
    backgroundColor: "rgba(145,255,0,0.16)",
    borderWidth: 1,
    borderColor: "rgba(145,255,0,0.42)",
  },
  cameraButtonText: {
    color: "#A3FF12",
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
    minHeight: 54,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cameraTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  cameraStatus: {
    color: "#94A3B8",
    fontSize: 10,
    marginTop: 2,
  },
  headerButton: {
    minWidth: 56,
    minHeight: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.11)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  headerButtonText: {
    color: "#DCE7F3",
    fontSize: 12,
    fontWeight: "800",
  },
  cameraPreviewFrame: {
    flex: 1,
    margin: 6,
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
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  cameraFloatingTop: {
    position: "absolute",
    top: 8,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(8,17,31,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  cameraFloatingStatus: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  cameraFloatingControls: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 8,
    flexDirection: "row",
    gap: 6,
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
    bottom: 54,
    maxWidth: "86%",
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: "rgba(8,17,31,0.42)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    textAlign: "center",
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
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  recognitionTab: {
    flex: 1,
    minHeight: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,17,31,0.36)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  recognitionTabActive: {
    backgroundColor: "rgba(71,209,108,0.34)",
    borderColor: "rgba(71,209,108,0.68)",
  },
  recognitionTabText: {
    color: "#DCE7F3",
    fontSize: 11,
    fontWeight: "900",
  },
  recognitionTabTextActive: {
    color: "#47D16C",
  },
  cameraHint: {
    color: "#94A3B8",
    fontSize: 10,
    textAlign: "center",
  },
  cameraStartButton: {
    marginTop: 6,
    minHeight: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,217,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(0,217,255,0.45)",
  },
  cameraStartText: {
    color: "#00D9FF",
    fontSize: 12,
    fontWeight: "900",
  },
  cameraPlayRoot: {
    flex: 1,
    backgroundColor: "#050A12",
  },
  cameraPlayField: {
    flex: 1,
    backgroundColor: "#050A12",
  },
  cameraPlayPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.04)",
    zIndex: 2,
  },
  cameraPlayHud: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(8,17,31,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    zIndex: 12,
  },
  cameraPlayHudText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  cameraPlayMessage: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 54,
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(8,17,31,0.36)",
    zIndex: 12,
  },
  cameraPlayControls: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    zIndex: 14,
  },
  cameraPlayMiniButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,17,31,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  cameraPlayMiniText: {
    color: "#DCE7F3",
    fontSize: 12,
    fontWeight: "900",
  },
  cameraPlayShotButton: {
    flex: 1.45,
    minHeight: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,217,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  cameraPlayShotText: {
    color: "#08111F",
    fontSize: 19,
    fontWeight: "900",
  },
  footTouchLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 46,
    bottom: 58,
    zIndex: 9,
  },
  volleyLane: {
    position: "absolute",
    left: "8%",
    right: "8%",
    top: "24%",
    bottom: "18%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,217,255,0.18)",
    backgroundColor: "rgba(0,217,255,0.035)",
  },
  footReachZone: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(163,255,18,0.66)",
    backgroundColor: "rgba(163,255,18,0.11)",
    zIndex: 7,
  },
  footMarker: {
    position: "absolute",
    backgroundColor: "rgba(3,8,17,0.82)",
    borderWidth: 2,
    borderColor: "#A3FF12",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 8,
  },
  footMarkerText: {
    color: "#A3FF12",
    fontSize: 9,
    fontWeight: "900",
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
