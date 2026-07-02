import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Canvas, Circle, Group, Path, Skia } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { OnDeviceVolleyCamera } from "@/components/OnDeviceVolleyCamera";
import { useGameContext } from "@/lib/game-context";
import {
  BALL_TYPE_CONFIG,
  COMBO_TIMEOUT_MS,
  DIFFICULTY_CONFIG,
  FRONT_KICK_MIN_P,
  KICK_MIN_SPEED,
  MOVENET_CONFIDENCE_THRESHOLD,
  asPlayDifficulty,
  calcBlackPenalty,
  calcNiceThroughBonus,
  calcScore,
  checkKick,
  generateBall,
  isBallExpired,
  updateBall,
  type FootPoint,
  type VolleyBall,
} from "@/lib/game-config";

const screen = Dimensions.get("window");
const DEFAULT_WIDTH = screen.width;
const DEFAULT_HEIGHT = screen.height;
const MODEL_ASSET = require("../../assets/models/movenet_singlepose_lightning_int8.tflite");

type FeetDetection = {
  left?: { x: number; y: number; confidence: number };
  right?: { x: number; y: number; confidence: number };
};

type GameStats = {
  score: number;
  hits: number;
  total: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  penalties: number;
  leftHits: number;
  rightHits: number;
  blackSafe: number;
  niceThrough: number;
  reactionTotal: number;
  reactionCount: number;
};

const initialStats: GameStats = {
  score: 0,
  hits: 0,
  total: 0,
  combo: 0,
  maxCombo: 0,
  perfect: 0,
  penalties: 0,
  leftHits: 0,
  rightHits: 0,
  blackSafe: 0,
  niceThrough: 0,
  reactionTotal: 0,
  reactionCount: 0,
};

function calcFootSpeed(
  point: { x: number; y: number },
  nowMs: number,
  previous?: { x: number; y: number; ts: number },
) {
  if (!previous) return 0;
  const dt = Math.max(16, nowMs - previous.ts) / 1000;
  return Math.hypot(point.x - previous.x, point.y - previous.y) / dt;
}

function ballPath(radius: number) {
  const path = Skia.Path.Make();
  path.moveTo(-radius * 0.5, -radius * 0.78);
  path.cubicTo(radius * 0.08, -radius * 0.34, radius * 0.2, radius * 0.22, -radius * 0.24, radius * 0.82);
  path.moveTo(radius * 0.52, -radius * 0.75);
  path.cubicTo(radius * 0.12, -radius * 0.2, radius * 0.2, radius * 0.4, radius * 0.68, radius * 0.72);
  path.moveTo(-radius * 0.82, radius * 0.08);
  path.cubicTo(-radius * 0.2, -radius * 0.02, radius * 0.22, radius * 0.06, radius * 0.82, radius * 0.2);
  return path;
}

function BallLayer({ balls }: { balls: VolleyBall[] }) {
  return (
    <>
      {balls.map((ball) => {
        const color = BALL_TYPE_CONFIG[ball.type].color;
        const stroke = ball.type === "BLACK" ? "#F8FAFC" : "#172033";
        const readyFront = ball.kind === "FRONT" && (ball.p ?? 0) >= FRONT_KICK_MIN_P;
        return (
          <Group key={ball.id} transform={[{ translateX: ball.x }, { translateY: ball.y }]}>
            {readyFront && (
              <Circle
                cx={0}
                cy={0}
                r={ball.radius + 22}
                color="rgba(163,255,18,0.18)"
                style="stroke"
                strokeWidth={5}
              />
            )}
            <Circle cx={0} cy={0} r={ball.radius + 7} color={`${color}33`} />
            <Circle cx={0} cy={0} r={ball.radius} color={color} />
            <Path path={ballPath(ball.radius)} color={stroke} style="stroke" strokeWidth={Math.max(2, ball.radius * 0.08)} />
          </Group>
        );
      })}
    </>
  );
}

function FootLayer({ feet, hitRadius }: { feet: FootPoint[]; hitRadius: number }) {
  return (
    <>
      {feet.map((foot) => {
        const fast = foot.speed >= KICK_MIN_SPEED;
        const color = foot.side === "L" ? "#A3FF12" : "#00D9FF";
        return (
          <Group key={foot.side}>
            <Circle
              cx={foot.x}
              cy={foot.y}
              r={hitRadius}
              color={fast ? `${color}26` : "rgba(255,255,255,0.08)"}
              style="stroke"
              strokeWidth={fast ? 4 : 2}
            />
            <Circle cx={foot.x} cy={foot.y} r={fast ? 12 : 8} color={color} />
          </Group>
        );
      })}
    </>
  );
}

export default function GameScreen() {
  const router = useRouter();
  const { gameState, setGameState } = useGameContext();
  const difficulty = asPlayDifficulty(gameState?.difficulty);
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [layout, setLayout] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [balls, setBalls] = useState<VolleyBall[]>([]);
  const [feet, setFeet] = useState<FootPoint[]>([]);
  const [stats, setStats] = useState<GameStats>(initialStats);
  const [timeRemaining, setTimeRemaining] = useState(cfg.timeLimit);
  const [isRunning, setIsRunning] = useState(true);
  const [banner, setBanner] = useState("足を振ってボールを蹴ろう");

  const ballsRef = useRef<VolleyBall[]>([]);
  const feetRef = useRef<FootPoint[]>([]);
  const statsRef = useRef<GameStats>(initialStats);
  const prevFeetRef = useRef<Record<"L" | "R", { x: number; y: number; ts: number } | undefined>>({
    L: undefined,
    R: undefined,
  });
  const lastFrameMsRef = useRef(Date.now());
  const lastSpawnMsRef = useRef(Date.now());
  const lastHitMsRef = useRef(0);
  const ballIdRef = useRef(0);
  const gameEndedRef = useRef(false);

  const finishGame = useCallback(() => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;
    setIsRunning(false);
    const finalStats = statsRef.current;
    setGameState({
      difficulty,
      score: finalStats.score,
      successCount: finalStats.hits,
      totalBalls: finalStats.total,
      maxCombo: finalStats.maxCombo,
      perfectCount: finalStats.perfect,
      penaltyCount: finalStats.penalties,
      leftHits: finalStats.leftHits,
      rightHits: finalStats.rightHits,
      blackSafeCount: finalStats.blackSafe,
      niceThroughCount: finalStats.niceThrough,
      averageReactionTime:
        finalStats.reactionCount > 0 ? finalStats.reactionTotal / finalStats.reactionCount : null,
    });
    router.replace("/game-result");
  }, [difficulty, router, setGameState]);

  const commitStats = useCallback((updater: (current: GameStats) => GameStats) => {
    const next = updater(statsRef.current);
    statsRef.current = next;
    setStats(next);
  }, []);

  const onFeetDetected = useCallback((detected: FeetDetection) => {
    const now = Date.now();
    const nextFeet: FootPoint[] = [];
    const addFoot = (
      side: "L" | "R",
      point: { x: number; y: number; confidence: number } | undefined,
    ) => {
      if (!point || point.confidence < MOVENET_CONFIDENCE_THRESHOLD) return;
      const speed = calcFootSpeed(point, now, prevFeetRef.current[side]);
      prevFeetRef.current[side] = { x: point.x, y: point.y, ts: now };
      nextFeet.push({ x: point.x, y: point.y, speed, side, confidence: point.confidence });
    };

    addFoot("L", detected.left);
    addFoot("R", detected.right);
    feetRef.current = nextFeet;
    setFeet(nextFeet);
  }, []);

  useEffect(() => {
    setTimeRemaining(cfg.timeLimit);
  }, [cfg.timeLimit]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          finishGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [finishGame, isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    const loop = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.05, Math.max(0.016, (now - lastFrameMsRef.current) / 1000));
      lastFrameMsRef.current = now;

      let nextBalls = ballsRef.current.map((ball) => updateBall(ball, dt, difficulty));
      const expired = nextBalls.filter((ball) => isBallExpired(ball, layout.width, layout.height));
      const niceThrough = expired.filter((ball) => ball.type === "BLACK" && !ball.kicked).length;
      const sideMiss = expired.some((ball) => ball.kind === "SIDE" && ball.type !== "BLACK" && !ball.kicked);

      if (expired.length > 0) {
        commitStats((current) => ({
          ...current,
          score: current.score + niceThrough * calcNiceThroughBonus(difficulty),
          combo: sideMiss ? 0 : current.combo,
          niceThrough: current.niceThrough + niceThrough,
        }));
        if (niceThrough > 0) setBanner("ナイススルー +5");
      }

      nextBalls = nextBalls.filter((ball) => !isBallExpired(ball, layout.width, layout.height));

      const feetSnapshot = feetRef.current;
      const hitBallIds = new Set<string>();
      for (const foot of feetSnapshot) {
        for (const ball of nextBalls) {
          if (hitBallIds.has(ball.id)) continue;
          const result = checkKick(ball, foot, cfg.hitRadius);
          if (result === "miss" || result === "touch") {
            if (result === "touch") setBanner("もっと強く振ろう");
            continue;
          }

          hitBallIds.add(ball.id);
          if (result === "black_safe") {
            setBanner("セーフ");
            commitStats((current) => ({ ...current, blackSafe: current.blackSafe + 1 }));
            continue;
          }

          if (result === "black_kick") {
            const penalty = calcBlackPenalty(difficulty);
            setBanner(`黒ボール -${penalty}`);
            commitStats((current) => ({
              ...current,
              score: current.score - penalty,
              combo: 0,
              penalties: current.penalties + 1,
            }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            continue;
          }

          const score = calcScore(ball.type, foot.speed, statsRef.current.combo, difficulty);
          const nextCombo = statsRef.current.combo + 1;
          lastHitMsRef.current = now;
          const reaction =
            ball.kind === "FRONT" && ball.kickWindowOpenedAtMs ? (now - ball.kickWindowOpenedAtMs) / 1000 : null;
          setBanner(score.perfect ? `PERFECT +${score.points}` : `KICK +${score.points}`);
          commitStats((current) => ({
            ...current,
            score: current.score + score.points,
            hits: current.hits + 1,
            combo: nextCombo,
            maxCombo: Math.max(current.maxCombo, nextCombo),
            perfect: current.perfect + (score.perfect ? 1 : 0),
            leftHits: current.leftHits + (foot.side === "L" ? 1 : 0),
            rightHits: current.rightHits + (foot.side === "R" ? 1 : 0),
            reactionTotal: current.reactionTotal + (reaction ?? 0),
            reactionCount: current.reactionCount + (reaction === null ? 0 : 1),
          }));
          Haptics.impactAsync(score.perfect ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
        }
      }

      nextBalls = nextBalls.filter((ball) => !hitBallIds.has(ball.id));

      if (now - lastSpawnMsRef.current >= cfg.spawnInterval) {
        lastSpawnMsRef.current = now;
        const primaryFoot = feetSnapshot.sort((a, b) => b.confidence! - a.confidence!)[0];
        nextBalls.push(generateBall(`ball-${ballIdRef.current++}`, layout.width, layout.height, difficulty, now, primaryFoot));
        commitStats((current) => ({ ...current, total: current.total + 1 }));
      }

      if (statsRef.current.combo > 0 && lastHitMsRef.current > 0 && now - lastHitMsRef.current > COMBO_TIMEOUT_MS) {
        commitStats((current) => ({ ...current, combo: 0 }));
      }

      ballsRef.current = nextBalls;
      setBalls(nextBalls);
    }, 16);

    return () => clearInterval(loop);
  }, [cfg.hitRadius, cfg.spawnInterval, commitStats, difficulty, isRunning, layout.height, layout.width]);

  const successRate = useMemo(() => (stats.total > 0 ? Math.round((stats.hits / stats.total) * 100) : 0), [stats]);

  return (
    <ScreenContainer className="bg-[#030811]" edges={["top", "left", "right", "bottom"]}>
      <View
        style={styles.root}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0) setLayout({ width, height });
        }}
      >
        <OnDeviceVolleyCamera
          width={layout.width}
          height={layout.height}
          modelAsset={MODEL_ASSET}
          onFeetDetected={onFeetDetected}
          showStatusBadge
        />
        <Canvas style={StyleSheet.absoluteFill}>
          <BallLayer balls={balls} />
          <FootLayer feet={feet} hitRadius={cfg.hitRadius} />
        </Canvas>

        <View style={styles.hudTop}>
          <View style={styles.hudPill}>
            <Text style={styles.hudLabel}>SCORE</Text>
            <Text style={styles.hudValue}>{stats.score}</Text>
          </View>
          <View style={[styles.hudPill, timeRemaining <= 10 && styles.dangerPill]}>
            <Text style={styles.hudLabel}>TIME</Text>
            <Text style={styles.hudValue}>{timeRemaining}</Text>
          </View>
          <View style={styles.hudPill}>
            <Text style={styles.hudLabel}>RATE</Text>
            <Text style={styles.hudValue}>{successRate}%</Text>
          </View>
        </View>

        <View style={styles.centerNotice} pointerEvents="none">
          <Text style={styles.noticeText}>{banner}</Text>
          {stats.combo > 0 && <Text style={styles.comboText}>{stats.combo} COMBO</Text>}
        </View>

        <View style={styles.bottomBar}>
          <Text style={styles.bottomText}>
            {difficulty}  Hits {stats.hits}/{stats.total}  Perfect {stats.perfect}  Black {stats.penalties}
          </Text>
          <TouchableOpacity style={styles.pauseButton} onPress={() => setIsRunning((value) => !value)}>
            <Text style={styles.pauseText}>{isRunning ? "PAUSE" : "RESUME"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.endButton} onPress={finishGame}>
            <Text style={styles.endText}>END</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#030811",
    overflow: "hidden",
  },
  hudTop: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  hudPill: {
    minWidth: 110,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(3,8,17,0.74)",
    borderWidth: 1,
    borderColor: "rgba(0,217,255,0.35)",
  },
  dangerPill: {
    borderColor: "rgba(248,113,113,0.8)",
  },
  hudLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "800",
  },
  hudValue: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 2,
  },
  centerNotice: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "42%",
    alignItems: "center",
  },
  noticeText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(3,8,17,0.54)",
  },
  comboText: {
    color: "#FFC53D",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 8,
  },
  bottomBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(3,8,17,0.74)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  bottomText: {
    flex: 1,
    color: "#DCE7F3",
    fontSize: 13,
    fontWeight: "800",
  },
  pauseButton: {
    minWidth: 78,
    height: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00D9FF",
  },
  pauseText: {
    color: "#031018",
    fontSize: 12,
    fontWeight: "900",
  },
  endButton: {
    width: 58,
    height: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F87171",
  },
  endText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
});
