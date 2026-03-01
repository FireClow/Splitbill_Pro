/**
 * AdMob Configuration
 * 
 * Centralized configuration for Google AdMob integration.
 * Automatically uses test IDs in development and production IDs in release builds.
 * 
 * To set up:
 * 1. Create AdMob account at https://admob.google.com
 * 2. Get your App ID and Ad Unit IDs
 * 3. Replace the productionIds below with YOUR actual IDs
 * 4. Test ads in development mode (uses safe test IDs)
 * 5. Deploy to production (automatically uses production IDs)
 */

import { Platform } from 'react-native';

/**
 * AdMob Unit IDs
 * 
 * Development Uses Google's Test IDs (safe to use during testing)
 * These will never generate invalid activity warnings
 */
export const ADMOB_CONFIG = {
  // App ID - Required for initialization
  appId: Platform.OS === 'ios' 
    ? 'ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy' // Replace with your iOS App ID
    : 'ca-app-pub-xxxxxxxxxxxxxxxx~zzzzzzzzzz', // Replace with your Android App ID

  // Android Ad Unit IDs
  android: {
    // Test IDs (safe for development)
    testIds: {
      banner: 'ca-app-pub-3940256099942544/6300978111',
      interstitial: 'ca-app-pub-3940256099942544/1033173712',
      rewarded: 'ca-app-pub-3940256099942544/5224354917',
      rewardedInterstitial: 'ca-app-pub-3940256099942544/5354046379',
      nativeAdvanced: 'ca-app-pub-3940256099942544/2247696110',
    },
    // Production IDs (replace with actual IDs from AdMob console)
    productionIds: {
      banner: 'ca-app-pub-YOUR_ANDROID_BANNER_ID/YOUR_SLOT_ID',
      interstitial: 'ca-app-pub-YOUR_ANDROID_INTERSTITIAL_ID/YOUR_SLOT_ID',
      rewarded: 'ca-app-pub-YOUR_ANDROID_REWARDED_ID/YOUR_SLOT_ID',
      rewardedInterstitial: 'ca-app-pub-YOUR_ANDROID_REWARDED_INT_ID/YOUR_SLOT_ID',
      nativeAdvanced: 'ca-app-pub-YOUR_ANDROID_NATIVE_ID/YOUR_SLOT_ID',
    },
  },

  // iOS Ad Unit IDs
  ios: {
    // Test IDs (safe for development)
    testIds: {
      banner: 'ca-app-pub-3940256099942544/2934735716',
      interstitial: 'ca-app-pub-3940256099942544/4411468910',
      rewarded: 'ca-app-pub-3940256099942544/1712485313',
      rewardedInterstitial: 'ca-app-pub-3940256099942544/6978759866',
      nativeAdvanced: 'ca-app-pub-3940256099942544/3986624511',
    },
    // Production IDs (replace with actual IDs from AdMob console)
    productionIds: {
      banner: 'ca-app-pub-YOUR_IOS_BANNER_ID/YOUR_SLOT_ID',
      interstitial: 'ca-app-pub-YOUR_IOS_INTERSTITIAL_ID/YOUR_SLOT_ID',
      rewarded: 'ca-app-pub-YOUR_IOS_REWARDED_ID/YOUR_SLOT_ID',
      rewardedInterstitial: 'ca-app-pub-YOUR_IOS_REWARDED_INT_ID/YOUR_SLOT_ID',
      nativeAdvanced: 'ca-app-pub-YOUR_IOS_NATIVE_ID/YOUR_SLOT_ID',
    },
  },

  // Feature Flags
  features: {
    enableBannerAds: true,
    enableInterstitialAds: true,
    enableRewardedAds: false, // Not yet implemented
    interstitialFrequency: 3, // Show every 3 bill creations
  },

  // GDPR & Consent Settings
  consent: {
    // Set to true in EU/EEA regions or when users haven't consented
    requireConsent: false,
    // User consent can be managed in-app settings
  },
};

/**
 * Helper function to get correct Ad Unit ID based on environment and platform
 */
export const getAdUnitId = (adType: 'banner' | 'interstitial' | 'rewarded' | 'rewardedInterstitial' | 'nativeAdvanced'): string => {
  const isDevMode = __DEV__;
  const platform = Platform.OS === 'ios' ? ADMOB_CONFIG.ios : ADMOB_CONFIG.android;
  
  const ids = isDevMode ? platform.testIds : platform.productionIds;
  return ids[adType];
};

/**
 * Environment Detection Helpers
 */
export const AdEnvironment = {
  isProduction: () => !__DEV__,
  isDevelopment: () => __DEV__,
  isAndroid: () => Platform.OS === 'android',
  isIOS: () => Platform.OS === 'ios',
  isWeb: () => Platform.OS === 'web',
};

/**
 * Setup Instructions for AdMob
 * 
 * 1. Create an AdMob Account:
 *    - Visit https://admob.google.com
 *    - Sign in with your Google Account
 * 
 * 2. Create an App in AdMob:
 *    - Select "Apps" in the left menu
 *    - Click "Add App"
 *    - Select platform (Android/iOS)
 *    - Follow the setup wizard
 * 
 * 3. Get Your App ID:
 *    - Go to App settings
 *    - Copy the "App ID"
 *    - Update ADMOB_CONFIG.appId above
 * 
 * 4. Create Ad Units:
 *    - Go to "Ad Units" in left menu
 *    - Click "Create Ad Unit"
 *    - Select format (Banner, Interstitial, etc.)
 *    - Copy the Ad Unit ID
 *    - Update the corresponding ID in productionIds above
 * 
 * 5. Initialize in Your App:
 *    - Add google-mobile-ads-sdk to your project
 *    - Call mobileAds.initialize(ADMOB_CONFIG.appId) in your app startup
 * 
 * 6. Test Before Release:
 *    - Use Test IDs first (never use production IDs in dev)
 *    - Monitor AdMob console for invalid activity
 *    - Add your device as a test device in AdMob settings
 * 
 * 7. Publish to Play Store/App Store:
 *    - Include Privacy Policy (see PRIVACY_POLICY.md)
 *    - Update app metadata with AdMob usage
 *    - Set production Ad Unit IDs
 *    - Monitor performance in AdMob console
 * 
 * Test Device Setup:
 * In AdMob Console:
 *   1. Go to Settings > Test Devices
 *   2. Add your test device by AAD (Android) or IDFA (iOS)
 *   3. Or use the test IDs provided above
 */

// Helper to log AdMob configuration (remove in production)
export const logAdMobConfig = () => {
  if (__DEV__) {
    console.log('[AdMob Config]', {
      environment: AdEnvironment.isDevelopment() ? 'Development' : 'Production',
      platform: Platform.OS,
      appId: ADMOB_CONFIG.appId,
      bannerAdId: getAdUnitId('banner'),
      interstitialAdId: getAdUnitId('interstitial'),
      features: ADMOB_CONFIG.features,
    });
  }
};
