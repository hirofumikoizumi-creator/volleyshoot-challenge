import React from 'react';
import { ScrollView, Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useRouter } from 'expo-router';
import { useGameContext } from '@/lib/game-context';
import { DIFFICULTY_CONFIG, BALL_TYPE_CONFIG } from '@/lib/game-config';

export default function GameRulesScreen() {
  const router = useRouter();
  const { gameState } = useGameContext();

  if (!gameState) {
    router.back();
    return null;
  }

  const difficultyConfig = DIFFICULTY_CONFIG[gameState.difficulty];

  const handleStartGame = () => {
    router.push('/(tabs)/game');
  };

  return (
    <ScreenContainer className="bg-[#0A0E27]" edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          {/* ヘッダー */}
          <View style={styles.header}>
            <Text style={styles.title}>ゲーム開始</Text>
            <Text style={styles.difficulty}>{gameState.difficulty}</Text>
          </View>

          {/* ゲーム説明 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 ゲーム説明</Text>
            <Text style={styles.sectionText}>
              60秒間で、飛んでくるボールをキックしてスコアを稼ぎます。{'\n'}
              足首でボールをキックするとスコアが加算されます。
            </Text>
          </View>

          {/* スコアシステム */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚽ スコアシステム</Text>

            <View style={styles.scoreItem}>
              <View style={[styles.ballCircle, { backgroundColor: '#FFFFFF' }]} />
              <View style={styles.scoreItemText}>
                <Text style={styles.scoreItemName}>通常ボール</Text>
                <Text style={styles.scoreItemPoints}>+10 点</Text>
              </View>
            </View>

            <View style={styles.scoreItem}>
              <View style={[styles.ballCircle, { backgroundColor: '#0099FF' }]} />
              <View style={styles.scoreItemText}>
                <Text style={styles.scoreItemName}>青ボール（レア）</Text>
                <Text style={styles.scoreItemPoints}>-30 点</Text>
              </View>
            </View>

            <View style={styles.scoreItem}>
              <View style={[styles.ballCircle, { backgroundColor: '#FFD700' }]} />
              <View style={styles.scoreItemText}>
                <Text style={styles.scoreItemName}>黄金ボール（超レア）</Text>
                <Text style={styles.scoreItemPoints}>+50 点</Text>
              </View>
            </View>
          </View>

          {/* 難易度情報 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎮 難易度情報</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ゲーム時間:</Text>
              <Text style={styles.infoValue}>{difficultyConfig.timeLimit} 秒</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ボール生成間隔:</Text>
              <Text style={styles.infoValue}>
                {(difficultyConfig.ballSpawnInterval / 1000).toFixed(1)} 秒
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ボール速度:</Text>
              <Text style={styles.infoValue}>
                {difficultyConfig.initialSpeed.min}-{difficultyConfig.initialSpeed.max}
              </Text>
            </View>
          </View>

          {/* 注意事項 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ 注意事項</Text>
            <Text style={styles.warningText}>
              • 十分なスペースを確保してください{'\n'}
              • カメラがボールを捉えられるようにしてください{'\n'}
              • 足首でボールをキックしてください
            </Text>
          </View>

          {/* スタートボタン */}
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartGame}
          >
            <Text style={styles.startButtonText}>ゲーム開始</Text>
          </TouchableOpacity>

          {/* キャンセルボタン */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>戻る</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#00D9FF',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00D9FF',
    marginBottom: 8,
  },
  difficulty: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00D9FF',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  scoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    marginBottom: 8,
  },
  ballCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  scoreItemText: {
    flex: 1,
  },
  scoreItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scoreItemPoints: {
    fontSize: 12,
    color: '#00D9FF',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  infoLabel: {
    fontSize: 14,
    color: '#CCCCCC',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00D9FF',
  },
  warningText: {
    fontSize: 14,
    color: '#FF6B6B',
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: '#00D9FF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A0E27',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CCCCCC',
  },
});
