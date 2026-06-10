import { useEffect, useRef, useState } from 'react';
import * as Audio from 'expo-audio';

export interface SoundManager {
  playKickSuccess: () => Promise<void>;
  playBlueBallHit: () => Promise<void>;
  playGoldBallHit: () => Promise<void>;
  playGameOver: () => Promise<void>;
  playCombo: () => Promise<void>;
  isReady: boolean;
}

/**
 * 効果音管理フック
 * 複数の効果音を管理し、キック成功時などのイベントで再生
 */
export function useSoundManager(): SoundManager {
  const soundsRef = useRef<Record<string, any | null>>({
    kickSuccess: null,
    blueBallHit: null,
    goldBallHit: null,
    gameOver: null,
    combo: null,
  });

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadSounds();
    return () => {
      unloadSounds();
    };
  }, []);

  const loadSounds = async () => {
    try {
      // 効果音の読み込み（実装予定）
      // 実際の使用時にはmp3ファイルを用意して以下のようにロード
      // const { sound: kickSound } = await Audio.Sound.createAsync(
      //   require('@/assets/sounds/kick-success.mp3')
      // );
      // soundsRef.current.kickSuccess = kickSound;

      setIsReady(true);
    } catch (error) {
      console.warn('Failed to load sounds:', error);
      setIsReady(true); // エラーでも続行
    }
  };

  const unloadSounds = async () => {
    try {
      for (const sound of Object.values(soundsRef.current)) {
        if (sound) {
          await sound.unloadAsync();
        }
      }
    } catch (error) {
      console.warn('Failed to unload sounds:', error);
    }
  };

  const playSound = async (soundKey: string) => {
    try {
      const sound = soundsRef.current[soundKey];
      if (sound && isReady) {
        // 効果音再生ロジック（実装予定）
        // await sound.replayAsync();
      }
    } catch (error) {
      console.warn(`Failed to play ${soundKey}:`, error);
    }
  };

  return {
    playKickSuccess: async () => await playSound('kickSuccess'),
    playBlueBallHit: async () => await playSound('blueBallHit'),
    playGoldBallHit: async () => await playSound('goldBallHit'),
    playGameOver: async () => await playSound('gameOver'),
    playCombo: async () => await playSound('combo'),
    isReady,
  };
}
