import { useCallback } from 'react';

export function useInterstitialAd() {
  const loadAd = useCallback(async () => {}, []);
  const showAd = useCallback(async () => {}, []);

  return {
    isLoaded: false,
    isLoading: false,
    error: null as string | null,
    loadAd,
    showAd,
  };
}
