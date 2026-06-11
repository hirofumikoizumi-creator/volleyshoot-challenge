import React, { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Difficulty = "EASY" | "NORMAL" | "HARD";
type Screen = "home" | "rules" | "training";

const difficultyLabels: Record<Difficulty, string> = {
  EASY: "EASY",
  NORMAL: "NORMAL",
  HARD: "HARD",
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [difficulty, setDifficulty] = useState<Difficulty>("NORMAL");
  const [score, setScore] = useState(0);
  const [kicks, setKicks] = useState(0);

  const successRate = useMemo(() => {
    if (kicks === 0) return "0";
    return Math.round((score / (kicks * 10)) * 100).toString();
  }, [kicks, score]);

  const startTraining = (nextDifficulty: Difficulty) => {
    setDifficulty(nextDifficulty);
    setScore(0);
    setKicks(0);
    setScreen("training");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        {screen === "home" && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.hero}>
              <Text style={styles.title}>ボレーシュート</Text>
              <Text style={styles.subtitle}>チャレンジ</Text>
              <Text style={styles.caption}>VOLLEY SHOOT CHALLENGE</Text>
            </View>

            <Text style={styles.description}>
              起動安定化版です。カメラ機能を再統合する前に、TestFlightで確実に起動できる状態を確認します。
            </Text>

            <Text style={styles.sectionTitle}>難易度</Text>
            {(["EASY", "NORMAL", "HARD"] as Difficulty[]).map((item) => (
              <Pressable
                key={item}
                style={({ pressed }) => [
                  styles.difficultyButton,
                  item === "EASY" && styles.easy,
                  item === "NORMAL" && styles.normal,
                  item === "HARD" && styles.hard,
                  pressed && styles.pressed,
                ]}
                onPress={() => startTraining(item)}
              >
                <Text style={styles.difficultyText}>{difficultyLabels[item]}</Text>
                <Text style={styles.difficultyHint}>
                  {item === "EASY"
                    ? "ゆっくり確認"
                    : item === "NORMAL"
                      ? "標準トレーニング"
                      : "高負荷チャレンジ"}
                </Text>
              </Pressable>
            ))}

            <Pressable style={styles.secondaryButton} onPress={() => setScreen("rules")}>
              <Text style={styles.secondaryText}>ルールを見る</Text>
            </Pressable>
          </ScrollView>
        )}

        {screen === "rules" && (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.titleSmall}>ゲームルール</Text>
            <Text style={styles.ruleText}>1. 飛んでくるボールに合わせてキックします。</Text>
            <Text style={styles.ruleText}>2. 通常ボールは加点、青いボールは減点、金色ボールは高得点です。</Text>
            <Text style={styles.ruleText}>3. 連続成功でコンボを狙います。</Text>
            <Text style={styles.ruleText}>4. カメラ認識版は起動安定確認後に再統合します。</Text>
            <Pressable style={styles.secondaryButton} onPress={() => setScreen("home")}>
              <Text style={styles.secondaryText}>戻る</Text>
            </Pressable>
          </ScrollView>
        )}

        {screen === "training" && (
          <View style={styles.training}>
            <Text style={styles.titleSmall}>{difficulty} MODE</Text>
            <View style={styles.scorePanel}>
              <Text style={styles.scoreLabel}>スコア</Text>
              <Text style={styles.scoreValue}>{score}</Text>
              <Text style={styles.scoreLabel}>キック数 {kicks} / 成功率 {successRate}%</Text>
            </View>
            <Pressable
              style={styles.kickButton}
              onPress={() => {
                setKicks((value) => value + 1);
                setScore((value) => value + 10);
              }}
            >
              <Text style={styles.kickText}>KICK</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setScreen("home")}>
              <Text style={styles.secondaryText}>終了</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0A0E27",
  },
  root: {
    flex: 1,
    backgroundColor: "#0A0E27",
  },
  content: {
    padding: 24,
    gap: 16,
  },
  hero: {
    paddingVertical: 28,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: "#123A5A",
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
    fontWeight: "700",
    marginTop: 2,
  },
  caption: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    marginTop: 12,
    letterSpacing: 1,
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
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  easy: {
    borderColor: "rgba(144,238,144,0.45)",
  },
  normal: {
    borderColor: "rgba(0,217,255,0.45)",
  },
  hard: {
    borderColor: "rgba(255,107,107,0.5)",
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
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
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
  ruleText: {
    color: "#C9D6E2",
    fontSize: 16,
    lineHeight: 26,
  },
  training: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 20,
  },
  scorePanel: {
    width: "100%",
    padding: 22,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  scoreLabel: {
    color: "#AAB7C4",
    fontSize: 14,
  },
  scoreValue: {
    color: "#FFFFFF",
    fontSize: 54,
    fontWeight: "900",
    marginVertical: 8,
  },
  kickButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00D9FF",
  },
  kickText: {
    color: "#0A0E27",
    fontSize: 28,
    fontWeight: "900",
  },
});
