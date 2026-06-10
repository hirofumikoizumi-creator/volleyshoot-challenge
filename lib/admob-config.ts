/**
 * Google AdMob 広告設定
 */

export const ADMOB_CONFIG = {
  // アプリID
  appId: 'ca-app-pub-5840457424714744~7348432585',

  // インタースティシャル広告
  interstitial: {
    adUnitId: 'ca-app-pub-5840457424714744/3409187574',
  },

  // バナー広告
  banner: {
    adUnitId: 'ca-app-pub-5840457424714744/1062764834',
  },
};

/**
 * テスト用広告ID（開発時のみ使用）
 */
export const TEST_ADMOB_CONFIG = {
  appId: 'ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy',
  interstitial: {
    adUnitId: 'ca-app-pub-3940256099942544/1033173712', // Google提供のテスト用ID
  },
  banner: {
    adUnitId: 'ca-app-pub-3940256099942544/6300978111', // Google提供のテスト用ID
  },
};

// 本番環境ではADMOB_CONFIG、開発環境ではTEST_ADMOB_CONFIGを使用
export const ACTIVE_ADMOB_CONFIG = __DEV__ ? TEST_ADMOB_CONFIG : ADMOB_CONFIG;
