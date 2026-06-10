import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '@/components/screen-container';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

interface RankingEntry {
  difficulty: string;
  score: number;
  successRate: number;
  date: string;
}

export default function RankingsScreen() {
  const router = useRouter();
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'EASY' | 'NORMAL' | 'HARD'>('NORMAL');

  useEffect(() => {
    loadRankings();
  }, []);

  const loadRankings = async () => {
    try {
      const stored = await AsyncStorage.getItem('rankings');
      if (stored) {
        setRankings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load rankings:', error);
    }
  };

  const filteredRankings = rankings
    .filter((r) => r.difficulty === selectedDifficulty)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY':
        return '#90EE90';
      case 'NORMAL':
        return '#00D9FF';
      case 'HARD':
        return '#FF6B6B';
      default:
        return '#CCCCCC';
    }
  };

  return (
    <ScreenContainer className="bg-[#0A0E27]" edges={['top', 'left', 'right', 'bottom']}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏆 ランキング</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* 難易度タブ */}
        <View style={styles.difficultyTabs}>
          {(['EASY', 'NORMAL', 'HARD'] as const).map((difficulty) => (
            <TouchableOpacity
              key={difficulty}
              style={[
                styles.difficultyTab,
                selectedDifficulty === difficulty && styles.difficultyTabActive,
              ]}
              onPress={() => setSelectedDifficulty(difficulty)}
            >
              <Text
                style={[
                  styles.difficultyTabText,
                  selectedDifficulty === difficulty && {
                    color: getDifficultyColor(difficulty),
                  },
                ]}
              >
                {difficulty}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ランキング一覧 */}
        <View style={styles.rankingsContainer}>
          {filteredRankings.length > 0 ? (
            filteredRankings.map((entry, index) => (
              <View key={index} style={styles.rankingItem}>
                <LinearGradient
                  colors={
                    index === 0
                      ? ['rgba(255, 215, 0, 0.1)', 'rgba(255, 215, 0, 0.05)']
                      : index === 1
                        ? ['rgba(192, 192, 192, 0.1)', 'rgba(192, 192, 192, 0.05)']
                        : index === 2
                          ? ['rgba(205, 127, 50, 0.1)', 'rgba(205, 127, 50, 0.05)']
                          : ['rgba(0, 217, 255, 0.05)', 'rgba(0, 217, 255, 0.02)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.rankingGradient}
                >
                  <View style={styles.rankingContent}>
                    <View style={styles.rankingLeft}>
                      <Text style={styles.rankingPosition}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                      </Text>
                      <View style={styles.rankingInfo}>
                        <Text style={styles.rankingScore}>{entry.score}点</Text>
                        <Text style={styles.rankingDate}>{entry.date}</Text>
                      </View>
                    </View>
                    <View style={styles.rankingRight}>
                      <Text style={styles.rankingSuccessRate}>
                        成功率: {(entry.successRate * 100).toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>まだランキングがありません</Text>
              <Text style={styles.emptyStateSubtext}>ゲームをプレイしてランキングに登録しましょう！</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 217, 255, 0.2)',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00D9FF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  difficultyTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  difficultyTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  difficultyTabActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    borderColor: 'rgba(0, 217, 255, 0.3)',
  },
  difficultyTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#AAAAAA',
  },
  rankingsContainer: {
    marginHorizontal: 16,
  },
  rankingItem: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rankingGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rankingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankingPosition: {
    fontSize: 24,
    marginRight: 12,
    width: 32,
    textAlign: 'center',
  },
  rankingInfo: {
    flex: 1,
  },
  rankingScore: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  rankingDate: {
    fontSize: 12,
    color: '#AAAAAA',
  },
  rankingRight: {
    alignItems: 'flex-end',
  },
  rankingSuccessRate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00D9FF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CCCCCC',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#AAAAAA',
  },
});
