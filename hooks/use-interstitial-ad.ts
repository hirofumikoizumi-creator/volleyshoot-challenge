import { useEffect, useState } from 'react';
import { AdMobInterstitial, setTestDeviceIDAsync } from 'expo-ads-admob';
import { ACTIVE_ADMOB_CONFIG } from '@/lib/admob-config';

export function useInterstitialAd() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 広告読み込み
  const loadAd = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // テストデバイス設定
      await setTestDeviceIDAsync('EMULATOR');

      // 広告ユニットID設定
      AdMobInterstitial.setAdUnitID(ACTIVE_ADMOB_CONFIG.interstitial.adUnitId);

      // 広告イベントリスナー設定
      AdMobInterstitial.addEventListener('interstitialDidLoad', () => {
        setIsLoaded(true);
        setIsLoading(false);
      });

      AdMobInterstitial.addEventListener('interstitialDidFailToLoad', (error: any) => {
        setError(error?.message || 'Ad loading error');
        setIsLoading(false);
      });

      AdMobInterstitial.addEventListener('interstitialDidClose', () => {
        setIsLoaded(false);
        // 次の広告を読み込む
        loadAd();
      });

      // 広告読み込み開始
      await AdMobInterstitial.requestAdAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  };

  // 広告表示
  const showAd = async () => {
    if (!isLoaded) {
      console.warn('Ad not loaded yet');
      return;
    }

    try {
      await AdMobInterstitial.showAdAsync();
    } catch (err) {
      console.error('Failed to show ad:', err);
    }
  };

  // 初期化時に広告読み込み
  useEffect(() => {
    loadAd();

    return () => {
      // クリーンアップ
      AdMobInterstitial.removeAllListeners();
    };
  }, []);

  return {
    isLoaded,
    isLoading,
    error,
    loadAd,
    showAd,
  };
}
