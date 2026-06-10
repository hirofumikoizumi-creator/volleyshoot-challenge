import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HighScoreEntry {
  difficulty: 'EASY' | 'NORMAL' | 'HARD';
  score: number;
  successRate: number;
  date: string;
  timestamp: number;
}

const STORAGE_KEY = 'highscores';
const MAX_ENTRIES_PER_DIFFICULTY = 50;

/**
 * ハイスコア管理フック
 * AsyncStorage でハイスコアを永続化し、難易度別に管理
 */
export function useHighScore() {
  const [highScores, setHighScores] = useState<HighScoreEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ハイスコアを読み込む
  useEffect(() => {
    loadHighScores();
  }, []);

  const loadHighScores = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const scores = JSON.parse(stored) as HighScoreEntry[];
        setHighScores(scores);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load high scores:', error);
      setIsLoading(false);
    }
  };

  const saveHighScore = async (entry: Omit<HighScoreEntry, 'timestamp'>) => {
    try {
      const newEntry: HighScoreEntry = {
        ...entry,
        timestamp: Date.now(),
      };

      const updated = [...highScores, newEntry]
        .sort((a, b) => {
          // 難易度ごとに分類
          if (a.difficulty !== b.difficulty) {
            return a.difficulty.localeCompare(b.difficulty);
          }
          // 同じ難易度内でスコアでソート
          return b.score - a.score;
        })
        .filter((score, index, arr) => {
          // 難易度ごとに最大50件まで保持
          const difficultyIndex = arr.findIndex((s) => s.difficulty === score.difficulty);
          const currentDifficultyCount = arr
            .slice(0, index + 1)
            .filter((s) => s.difficulty === score.difficulty).length;
          return currentDifficultyCount <= MAX_ENTRIES_PER_DIFFICULTY;
        });

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setHighScores(updated);
      return newEntry;
    } catch (error) {
      console.error('Failed to save high score:', error);
      return null;
    }
  };

  const getTopScores = (difficulty: 'EASY' | 'NORMAL' | 'HARD', limit: number = 10) => {
    return highScores
      .filter((score) => score.difficulty === difficulty)
      .slice(0, limit);
  };

  const getPersonalBest = (difficulty: 'EASY' | 'NORMAL' | 'HARD') => {
    return highScores.find((score) => score.difficulty === difficulty);
  };

  const clearAllScores = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setHighScores([]);
    } catch (error) {
      console.error('Failed to clear scores:', error);
    }
  };

  return {
    highScores,
    isLoading,
    saveHighScore,
    getTopScores,
    getPersonalBest,
    clearAllScores,
  };
}
