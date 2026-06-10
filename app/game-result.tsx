import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useRouter } from 'expo-router';
import { useGameContext } from '@/lib/game-context';
import { getRankFromSuccessRate, DIFFICULTY_CONFIG } from '@/lib/game-config';
import { useInterstitialAd } from '@/hooks/use-interstitial-ad';
import { useHighScore } from '@/hooks/use-high-score';
import { useSoundManager } from '@/hooks/use-sound-manager';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function GameResultScreen() {
  const router = useRouter();
  const { gameState, resetGameState } = useGameContext();
  const { showAd } = useInterstitialAd();
  const { saveHighScore } = useHighScore();
  const { playGameOver } = useSoundManager();
  const [adShown, setAdShown] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(0));
  const [opacityAnim] = useState(new Animated.Value(0));

  // 結果画面表示時に広告を表示とハイスコア保存
  useEffect(() => {
    if (!adShown && gameState) {
      showAd?.();
      setAdShown(true);

      // ハイスコアを保存
      const successRate = gameState.totalBalls > 0 ? gameState.successCount / gameState.totalBalls : 0;
      const today = new Date().toLocaleDateString('ja-JP');
      saveHighScore?.({
        difficulty: gameState.difficulty,
        score: gameState.score,
        successRate,
        date: today,
      }).then((result) => {
        if (result) {
          setIsNewRecord(true);
          playGameOver?.();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          // アニメーション開始
          Animated.parallel([
            Animated.spring(scaleAnim, {
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ]).start();
        }
      });
    }
  }, [adShown, gameState]);

  if (!gameState) {
    router.back();
    return null;
  }

  const successRate = gameState.totalBalls > 0 ? gameState.successCount / gameState.totalBalls : 0;
  const rank = getRankFromSuccessRate(successRate);
  const difficultyConfig = DIFFICULTY_CONFIG[gameState.difficulty];

  const handlePlayAgain = () => {
    resetGameState?.();
    router.push('/game-rules');
  };

  const handleHome = () => {
    resetGameState?.();
    router.push('/(tabs)');
  };

  return (
    <ScreenContainer className="bg-[#0A0E27]" edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* 新記録バナー（アニメーション付き） */}
          {isNewRecord && (
            <Animated.View
              style={[
                styles.newRecordBanner,
                {
                  transform: [{ scale: scaleAnim }],
                  opacity: opacityAnim,
                },
              ]}
            >
              <LinearGradient
                colors={['#FFD700', '#FFA500']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.newRecordGradient}
              >
                <Text style={styles.newRecordText}>🎉 新記録! 🎉</Text>
              </LinearGradient>
            </Animated.View>
          )}

          {/* ランク表示（大きく目立たせる） */}
          <View style={styles.rankSection}>
            <Text style={styles.rankEmoji}>{rank.emoji}</Text>
            <LinearGradient
              colors={[rank.color + '40', rank.color + '10']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.rankBadge,
                { borderColor: rank.color },
              ]}
            >
              <Text style={[styles.rankText, { color: rank.color }]}>{rank.rank}</Text>
              <Text style={[styles.rankSubText, { color: rank.color }]}>ランク</Text>
            </LinearGradient>
          </View>

          {/* スコア表示 */}
          <View style={styles.scoreSection}>
            <LinearGradient
              colors={['rgba(0, 217, 255, 0.1)', 'rgba(10, 14, 39, 0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.scoreGradient}
            >
              <Text style={styles.scoreLabel}>最終スコア</Text>
              <Text style={styles.scoreValue}>{gameState.score}</Text>
            </LinearGradient>
          </View>

          {/* 統計情報 */}
          <View style={styles.statsSection}>
            <Text style={styles.statsTitle}>📊 ゲーム統計</Text>

            {/* 難易度 */}
            <View style={styles.statCard}>
              <View style={styles.statCardLeft}>
                <Text style={styles.statCardLabel}>難易度</Text>
                <Text style={styles.statCardValue}>{gameState.difficulty}</Text>
              </View>
              <View style={[styles.statCardRight, { backgroundColor: difficultyConfig.color + '30' }]}>
                <Text style={styles.difficultyEmoji}>{difficultyConfig.emoji}</Text>
              </View>
            </View>

            {/* 成功数 */}
            <View style={styles.statCard}>
              <View style={styles.statCardLeft}>
                <Text style={styles.statCardLabel}>成功数</Text>
                <Text style={styles.statCardValue}>{gameState.successCount} / {gameState.totalBalls}</Text>
              </View>
              <View style={styles.statCardRight}>
                <Text style={styles.statCardPercentage}>{(successRate * 100).toFixed(1)}%</Text>
              </View>
            </View>

            {/* 最大コンボ */}
            <View style={styles.statCard}>
              <View style={styles.statCardLeft}>
                <Text style={styles.statCardLabel}>最大コンボ</Text>
                <Text style={styles.statCardValue}>{gameState.maxCombo}</Text>
              </View>
              <View style={styles.statCardRight}>
                <Text style={styles.comboEmoji}>🔥</Text>
              </View>
            </View>

            {/* 成功率ゲージ */}
            <View style={styles.successRateContainer}>
              <Text style={styles.successRateLabel}>成功率</Text>
              <View style={styles.progressBarBackground}>
                <LinearGradient
                  colors={['#00D9FF', '#0A7EA4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.progressBar,
                    { width: `${successRate * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.successRateValue}>{(successRate * 100).toFixed(1)}%</Text>
            </View>
          </View>

          {/* ボタン */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.playAgainButton}
              onPress={handlePlayAgain}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#00D9FF', '#0A7EA4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>🎮 もう一度プレイ</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.homeButton}
              onPress={handleHome}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['rgba(76, 175, 80, 0.8)', 'rgba(56, 142, 60, 0.8)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>🏠 ホームに戻る</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  newRecordBanner: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
  },
  newRecordGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  newRecordText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  rankSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  rankEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  rankBadge: {
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  rankText: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  rankSubText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  scoreSection: {
    marginBottom: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  scoreGradient: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderRadius: 16,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0B0B0',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#00D9FF',
  },
  statsSection: {
    marginBottom: 32,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  statCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.2)',
  },
  statCardLeft: {
    flex: 1,
  },
  statCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B0B0B0',
    marginBottom: 4,
  },
  statCardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statCardRight: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
  },
  difficultyEmoji: {
    fontSize: 32,
  },
  statCardPercentage: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00D9FF',
  },
  comboEmoji: {
    fontSize: 28,
  },
  successRateContainer: {
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.2)',
  },
  successRateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0B0B0',
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  successRateValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00D9FF',
    textAlign: 'right',
  },
  buttonContainer: {
    gap: 12,
  },
  playAgainButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  homeButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
