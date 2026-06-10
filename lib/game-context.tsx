import React, { createContext, useContext, useState } from 'react';

export type GameDifficulty = 'EASY' | 'NORMAL' | 'HARD';

export interface GameState {
  difficulty: GameDifficulty;
  score: number;
  successCount: number;
  totalBalls: number;
  maxCombo: number;
}

interface GameContextType {
  gameState: GameState | null;
  setGameState: (state: GameState) => void;
  resetGameState: () => void;
  setDifficulty: (difficulty: GameDifficulty) => void;
  updateScore: (score: number, success: boolean) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [gameState, setGameState] = useState<GameState | null>(null);

  const resetGameState = () => {
    setGameState(null);
  };

  const setDifficulty = (difficulty: GameDifficulty) => {
    setGameState({
      difficulty,
      score: 0,
      successCount: 0,
      totalBalls: 0,
      maxCombo: 0,
    });
  };

  const updateScore = (score: number, success: boolean) => {
    if (!gameState) return;

    setGameState({
      ...gameState,
      score: gameState.score + score,
      successCount: success ? gameState.successCount + 1 : gameState.successCount,
      totalBalls: gameState.totalBalls + 1,
    });
  };

  return (
    <GameContext.Provider value={{ gameState, setGameState, resetGameState, setDifficulty, updateScore }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within GameProvider');
  }
  return context;
}
