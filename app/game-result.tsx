import React, { useEffect, useMemo, useState } from "react";
import { Share, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useGameContext } from "@/lib/game-context";
import { DIFFICULTY_CONFIG, getRankFromStats } from "@/lib/game-config";
import { useHighScore } from "@/hooks/use-high-score";
import { useInterstitialAd } from "@/hooks/use-interstitial-ad";

const STREAK_KEY = "volleyshoot:daily-streak";

type StreakRecord = {
  date: string;
  count: number;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function previousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export default function GameResultScreen() {
  const router = useRouter();
  const { gameState, resetGameState } = useGameContext();
  const { saveHighScore } = useHighScore();
  const { showAd } = useInterstitialAd();
  const [streak, setStreak] = useState(1);

  useEffect(() => {
    showAd?.();
  }, [showAd]);

  useEffect(() => {
    if (!gameState) return;
    const successRate = gameState.totalBalls > 0 ? gameState.successCount / gameState.totalBalls : 0;
    saveHighScore?.({
      difficulty: gameState.difficulty,
      score: gameState.score,
      successRate,
      date: new Date().toLocaleDateString("ja-JP"),
    });
  }, [gameState, saveHighScore]);

  useEffect(() => {
    let mounted = true;
    async function updateStreak() {
      const current = todayKey();
      const raw = await AsyncStorage.getItem(STREAK_KEY);
      const previous: StreakRecord | null = raw ? JSON.parse(raw) : null;
      const nextCount =
        previous?.date === current
          ? previous.count
          : previous?.date === previousDateKey(current)
            ? previous.count + 1
            : 1;
      await AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ date: current, count: nextCount }));
      if (mounted) setStreak(nextCount);
    }
    updateStreak();
    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    if (!gameState) return null;
    const successRate = gameState.totalBalls > 0 ? gameState.successCount / gameState.totalBalls : 0;
    const perfectCount = gameState.perfectCount ?? 0;
    const penaltyCount = gameState.penaltyCount ?? 0;
    return {
      successRate,
      rank: getRankFromStats({
        successCount: gameState.successCount,
        totalBalls: gameState.totalBalls,
        penaltyCount,
        perfectCount,
      }),
    };
  }, [gameState]);

  if (!gameState || !summary) return null;

  const cfg = DIFFICULTY_CONFIG[gameState.difficulty];
  const averageReaction = gameState.averageReactionTime;

  const handlePlayAgain = () => {
    router.replace("/game-rules");
  };

  const handleHome = () => {
    resetGameState?.();
    router.replace("/(tabs)");
  };

  const handleShare = async () => {
    await Share.share({
      message: `ボレーシュートチャレンジ ${summary.rank.rank}ランク / ${gameState.score}点 / 成功率 ${(summary.successRate * 100).toFixed(1)}%`,
    });
  };

  return (
    <ScreenContainer className="bg-[#06101D]" edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={[styles.rankBadge, { borderColor: summary.rank.color }]}>
            <Text style={[styles.rankText, { color: summary.rank.color }]}>{summary.rank.rank}</Text>
            <Text style={styles.rankLabel}>{summary.rank.label}</Text>
          </View>
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreLabel}>SCORE</Text>
            <Text style={styles.score}>{gameState.score}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <Stat label="難易度" value={gameState.difficulty} accent={cfg.color} />
          <Stat label="成功数" value={`${gameState.successCount}/${gameState.totalBalls}`} />
          <Stat label="成功率" value={`${(summary.successRate * 100).toFixed(1)}%`} />
          <Stat label="最大コンボ" value={String(gameState.maxCombo)} />
          <Stat label="PERFECT" value={String(gameState.perfectCount ?? 0)} accent="#FFC53D" />
          <Stat label="黒ボール減点" value={String(gameState.penaltyCount ?? 0)} accent="#F87171" />
          <Stat label="左足/右足" value={`${gameState.leftHits ?? 0}/${gameState.rightHits ?? 0}`} />
          <Stat
            label="平均反応"
            value={averageReaction === null || averageReaction === undefined ? "-" : `${averageReaction.toFixed(2)}秒`}
          />
          <Stat label="セーフ" value={String(gameState.blackSafeCount ?? 0)} />
          <Stat label="ナイススルー" value={String(gameState.niceThroughCount ?? 0)} />
          <Stat label="連続日数" value={`${streak}日`} accent="#A3FF12" />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={handlePlayAgain}>
            <Text style={styles.primaryText}>もう一度プレイ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleShare}>
            <Text style={styles.secondaryText}>シェア</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleHome}>
            <Text style={styles.secondaryText}>ホームへ</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function Stat({ label, value, accent = "#00D9FF" }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 18,
    paddingBottom: 32,
  },
  hero: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
    marginBottom: 16,
  },
  rankBadge: {
    width: 150,
    minHeight: 132,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  rankText: {
    fontSize: 58,
    fontWeight: "900",
    lineHeight: 66,
  },
  rankLabel: {
    color: "#DCE7F3",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  scoreBlock: {
    flex: 1,
    minHeight: 132,
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: "center",
    backgroundColor: "rgba(0,217,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(0,217,255,0.28)",
  },
  scoreLabel: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "900",
  },
  score: {
    color: "#F8FAFC",
    fontSize: 54,
    fontWeight: "900",
    marginTop: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  stat: {
    width: "31.8%",
    minWidth: 120,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00D9FF",
  },
  primaryText: {
    color: "#06101D",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    width: 104,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  secondaryText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "900",
  },
});
