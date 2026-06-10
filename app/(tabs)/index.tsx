import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useRouter } from 'expo-router';
import { useGameContext } from '@/lib/game-context';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { setGameState } = useGameContext();
  const [showRulesModal, setShowRulesModal] = useState(false);

  const handleDifficultySelect = (difficulty: 'EASY' | 'NORMAL' | 'HARD') => {
    setGameState({ difficulty, score: 0, successCount: 0, totalBalls: 0, maxCombo: 0 });
    router.push('/game-rules');
  };

  const handleRankings = () => {
    router.push('/rankings');
  };

  const handleTraining = () => {
    setGameState({ difficulty: 'NORMAL', score: 0, successCount: 0, totalBalls: 0, maxCombo: 0 });
    router.push('/training-mode');
  };

  return (
    <ScreenContainer className="bg-[#0A0E27]" edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* ヘッダー */}
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={['#00D9FF', '#0A7EA4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <Text style={styles.headerTitle}>⚽ ボレーシュート</Text>
            <Text style={styles.headerSubtitle}>チャレンジ</Text>
            <Text style={styles.headerEnglish}>VOLLEY SHOOT CHALLENGE</Text>
          </LinearGradient>
        </View>

        {/* 説明テキスト */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>
            スマホのカメラの前に立ち、飛んでくるボールをキックするトレーニングアプリ
          </Text>
        </View>

        {/* 難易度選択セクション */}
        <View style={styles.difficultySection}>
          <Text style={styles.sectionTitle}>難易度を選択</Text>

          {/* EASY */}
          <TouchableOpacity
            style={[styles.difficultyCard, styles.easyCard]}
            onPress={() => handleDifficultySelect('EASY')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['rgba(144, 238, 144, 0.2)', 'rgba(144, 238, 144, 0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.difficultyGradient}
            >
              <View style={styles.difficultyContent}>
                <View style={styles.difficultyLeft}>
                  <Text style={[styles.difficultyTitle, { color: '#90EE90' }]}>EASY</Text>
                  <Text style={styles.difficultyDesc}>ゆっくり、少ないボール</Text>
                </View>
                <View style={styles.difficultyRight}>
                  <Text style={styles.uniformEmoji}>👕</Text>
                  <Text style={[styles.levelStars, { color: '#90EE90' }]}>⭐⭐⭐</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* NORMAL */}
          <TouchableOpacity
            style={[styles.difficultyCard, styles.normalCard]}
            onPress={() => handleDifficultySelect('NORMAL')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['rgba(0, 217, 255, 0.2)', 'rgba(0, 217, 255, 0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.difficultyGradient}
            >
              <View style={styles.difficultyContent}>
                <View style={styles.difficultyLeft}>
                  <Text style={[styles.difficultyTitle, { color: '#00D9FF' }]}>NORMAL</Text>
                  <Text style={styles.difficultyDesc}>標準的なペース</Text>
                </View>
                <View style={styles.difficultyRight}>
                  <Text style={styles.uniformEmoji}>⚽</Text>
                  <Text style={[styles.levelStars, { color: '#00D9FF' }]}>⭐⭐</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* HARD */}
          <TouchableOpacity
            style={[styles.difficultyCard, styles.hardCard]}
            onPress={() => handleDifficultySelect('HARD')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['rgba(255, 107, 107, 0.2)', 'rgba(255, 107, 107, 0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.difficultyGradient}
            >
              <View style={styles.difficultyContent}>
                <View style={styles.difficultyLeft}>
                  <Text style={[styles.difficultyTitle, { color: '#FF6B6B' }]}>HARD</Text>
                  <Text style={styles.difficultyDesc}>速い、多いボール</Text>
                </View>
                <View style={styles.difficultyRight}>
                  <Text style={styles.uniformEmoji}>🔴</Text>
                  <Text style={[styles.levelStars, { color: '#FF6B6B' }]}>⭐</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* その他のモード */}
        <View style={styles.modesSection}>
          {/* ルール説明ボタン */}
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => setShowRulesModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.infoButtonIcon}>ℹ️</Text>
            <Text style={styles.infoButtonText}>ルール説明</Text>
          </TouchableOpacity>

          {/* ランキングボタン */}
          <TouchableOpacity
            style={styles.rankingButton}
            onPress={handleRankings}
            activeOpacity={0.8}
          >
            <Text style={styles.rankingButtonIcon}>🏆</Text>
            <Text style={styles.rankingButtonText}>ランキング</Text>
          </TouchableOpacity>

          {/* トレーニングモードボタン */}
          <TouchableOpacity
            style={styles.trainingButton}
            onPress={handleTraining}
            activeOpacity={0.8}
          >
            <Text style={styles.trainingButtonIcon}>🎯</Text>
            <Text style={styles.trainingButtonText}>トレーニング</Text>
          </TouchableOpacity>
        </View>

        {/* ルール説明モーダル */}
        {showRulesModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowRulesModal(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>

              <Text style={styles.modalTitle}>ゲームルール</Text>

              <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.ruleItem}>
                  <Text style={styles.ruleNumber}>1</Text>
                  <View style={styles.ruleContent}>
                    <Text style={styles.ruleTitle}>スコアシステム</Text>
                    <Text style={styles.ruleText}>
                      • 通常のボール: +10点{'\n'}
                      • 青いボール: -30点{'\n'}
                      • 黄金のボール: +50点
                    </Text>
                  </View>
                </View>

                <View style={styles.ruleItem}>
                  <Text style={styles.ruleNumber}>2</Text>
                  <View style={styles.ruleContent}>
                    <Text style={styles.ruleTitle}>ゲーム時間</Text>
                    <Text style={styles.ruleText}>
                      各難易度で異なる時間制限があります。時間内にできるだけ多くのボールをキックしてください。
                    </Text>
                  </View>
                </View>

                <View style={styles.ruleItem}>
                  <Text style={styles.ruleNumber}>3</Text>
                  <View style={styles.ruleContent}>
                    <Text style={styles.ruleTitle}>コンボシステム</Text>
                    <Text style={styles.ruleText}>
                      連続でボールをキックするとコンボが増加します。コンボが高いほどボーナスポイントが増えます。
                    </Text>
                  </View>
                </View>

                <View style={styles.ruleItem}>
                  <Text style={styles.ruleNumber}>4</Text>
                  <View style={styles.ruleContent}>
                    <Text style={styles.ruleTitle}>カメラ権限</Text>
                    <Text style={styles.ruleText}>
                      ゲームプレイにはカメラへのアクセス権限が必要です。初回起動時に許可してください。
                    </Text>
                  </View>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={styles.modalCloseMainButton}
                onPress={() => setShowRulesModal(false)}
              >
                <Text style={styles.modalCloseMainButtonText}>閉じる</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginTop: 16,
  },
  headerGradient: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 32,
    fontWeight: '600',
    color: '#00D9FF',
    marginBottom: 12,
  },
  headerEnglish: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1,
  },
  descriptionContainer: {
    marginHorizontal: 16,
    marginBottom: 32,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 217, 255, 0.05)',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#00D9FF',
  },
  descriptionText: {
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  difficultySection: {
    marginHorizontal: 16,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  difficultyCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  easyCard: {
    borderColor: 'rgba(144, 238, 144, 0.3)',
  },
  normalCard: {
    borderColor: 'rgba(0, 217, 255, 0.3)',
  },
  hardCard: {
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  difficultyGradient: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  difficultyContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  difficultyLeft: {
    flex: 1,
  },
  difficultyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  difficultyDesc: {
    fontSize: 13,
    color: '#AAAAAA',
  },
  difficultyRight: {
    alignItems: 'center',
    marginLeft: 16,
  },
  uniformEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  levelStars: {
    fontSize: 12,
    fontWeight: '600',
  },
  modesSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.3)',
    marginBottom: 10,
  },
  infoButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00D9FF',
  },
  rankingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    marginBottom: 10,
  },
  rankingButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  rankingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFD700',
  },
  trainingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(144, 238, 144, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(144, 238, 144, 0.3)',
  },
  trainingButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  trainingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#90EE90',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#1A1F3A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalCloseText: {
    fontSize: 24,
    color: '#CCCCCC',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  modalScrollView: {
    marginBottom: 20,
  },
  ruleItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  ruleNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00D9FF',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 217, 255, 0.2)',
    textAlign: 'center',
    lineHeight: 32,
    marginRight: 16,
  },
  ruleContent: {
    flex: 1,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  ruleText: {
    fontSize: 13,
    color: '#AAAAAA',
    lineHeight: 20,
  },
  modalCloseMainButton: {
    backgroundColor: '#00D9FF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseMainButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0E27',
  },
});
