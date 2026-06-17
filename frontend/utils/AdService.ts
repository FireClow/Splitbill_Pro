/**
 * AdService - Centralized Google AdMob Management
 * 
 * Provides production-only ads with feature flags for premium users.
 * Handles both Banner and Interstitial ads with error handling and frequency control.
 * 
 * Features:
 * - Banner ad management
 * - Interstitial frequency control (show every N actions)
 * - Premium user bypass
 * - Production-only ads (disabled in development)
 * - Error recovery and retry logic
 */

import { Platform } from 'react-native';
import { logger } from './logger';
import { MVP_FLAGS } from '../constants/mvpFlags';

// Note: react-native-google-mobile-ads provides BannerAdSize and InterstitialAd
// These are imported and configured in BannerAd.tsx and interstitial setup

// AdMob IDs - Use test IDs during development, production IDs in release
const ADMOB_IDS = {
  // Android IDs
  android: {
    banner: __DEV__ ? 'ca-app-pub-3940256099942544/6300978111' : 'ca-app-pub-YOUR_ANDROID_BANNER_ID/YOUR_SLOT_ID',
    interstitial: __DEV__ ? 'ca-app-pub-3940256099942544/1033173712' : 'ca-app-pub-YOUR_ANDROID_INTERSTITIAL_ID/YOUR_SLOT_ID',
  },
  // iOS IDs (optional - can be added later)
  ios: {
    banner: __DEV__ ? 'ca-app-pub-3940256099942544/2934735716' : 'ca-app-pub-YOUR_IOS_BANNER_ID/YOUR_SLOT_ID',
    interstitial: __DEV__ ? 'ca-app-pub-3940256099942544/4411468910' : 'ca-app-pub-YOUR_IOS_INTERSTITIAL_ID/YOUR_SLOT_ID',
  },
};

/**
 * Feature flags for ad control
 */
interface AdConfig {
  isProduction: boolean;
  isPremiumUser: boolean;
  isEnabled: boolean;
}

/**
 * Get appropriate AdMob ID based on platform
 */
export const getAdMobId = (adType: 'banner' | 'interstitial'): string => {
  const platfAdIds = Platform.OS === 'ios' ? ADMOB_IDS.ios : ADMOB_IDS.android;
  return platfAdIds[adType];
};

/**
 * Check if ads should be shown
 */
export const shouldShowAds = (config: AdConfig): boolean => {
  if (!MVP_FLAGS.enableAds) {
    return false;
  }

  // Ads only in production, and only if user is not premium
  return Platform.OS !== 'web' && config.isProduction && !config.isPremiumUser && config.isEnabled;
};

/**
 * Banner Ad Configuration
 */
export class BannerAdService {
  private isLoaded = false;
  private adUnitId: string;

  constructor() {
    this.adUnitId = getAdMobId('banner');
  }

  isAdLoaded(): boolean {
    return this.isLoaded;
  }

  setLoaded(loaded: boolean): void {
    this.isLoaded = loaded;
  }

  getAdUnitId(): string {
    return this.adUnitId;
  }
}

/**
 * Interstitial Ad Manager - Handles frequency control
 */
export class InterstitialAdManager {
  private interstitialAd: any = null;
  private isLoaded = false;
  private isShowing = false;
  private adUnitId: string;
  private billCreationCount = 0;
  private showFrequency = 3; // Show every 3 bill creations

  constructor() {
    this.adUnitId = getAdMobId('interstitial');
    if (Platform.OS === 'web') {
      return;
    }
    this.loadAd();
  }

  /**
   * Load interstitial ad
   */
  private loadAd(): void {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      // Get InterstitialAd from react-native-google-mobile-ads
      const InterstitialAd = (globalThis as any).InterstitialAd;
      
      if (!InterstitialAd) {
        logger.warn('AdService', 'InterstitialAd not available - react-native-google-mobile-ads not initialized');
        return;
      }
      
      this.interstitialAd = InterstitialAd.createForAdRequest(this.adUnitId);

      // Register event handlers
      this.interstitialAd
        .addAdEventListener('adLoaded', () => {
          this.isLoaded = true;
          logger.log('AdService', 'Interstitial ad loaded');
        })
        .addAdEventListener('adFailedToLoad', () => {
          this.isLoaded = false;
          logger.warn('AdService', 'Interstitial ad error, retrying...');
          setTimeout(() => this.loadAd(), 2000);
        })
        .addAdEventListener('adOpened', () => {
          this.isShowing = true;
        })
        .addAdEventListener('adClosed', () => {
          this.isShowing = false;
          this.resetFrequency();
          this.loadAd(); // Reload for next ad
        });

      // Load the ad
      this.interstitialAd.load();
    } catch (error) {
      logger.warn('AdService', 'Interstitial creation error', error);
    }
  }

  /**
   * Track bill creation and show ad if frequency reached
   */
  public async trackBillCreation(): Promise<void> {
    this.billCreationCount++;
    logger.log('AdService', `Bill created (${this.billCreationCount}/${this.showFrequency})`);

    if (this.billCreationCount >= this.showFrequency) {
      await this.show();
    }
  }

  /**
   * Show interstitial ad
   */
  public async show(): Promise<void> {
    if (!this.isLoaded || this.isShowing) {
      logger.log('AdService', 'Interstitial ad not ready');
      return;
    }

    try {
      if (this.interstitialAd) {
        this.interstitialAd.show();
      }
    } catch (error) {
      logger.warn('AdService', 'Interstitial show error', error);
      this.resetFrequency(); // Still reset on error
    }
  }

  /**
   * Reset frequency counter
   */
  private resetFrequency(): void {
    this.billCreationCount = 0;
    logger.log('AdService', 'Frequency counter reset');
  }

  /**
   * Get current frequency count
   */
  public getFrequencyCount(): number {
    return this.billCreationCount;
  }

  /**
   * Set custom frequency (for testing)
   */
  public setFrequency(frequency: number): void {
    this.showFrequency = frequency;
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    if ((this as any).unsubscribe) {
      (this as any).unsubscribe();
    }
    this.interstitialAd = null;
    this.isLoaded = false;
  }
}

/**
 * Singleton instance
 */
let interstitialManager: InterstitialAdManager | null = null;

export const getInterstitialAdManager = (): InterstitialAdManager => {
  if (!interstitialManager) {
    interstitialManager = new InterstitialAdManager();
  }
  return interstitialManager;
};

export const destroyInterstitialAdManager = (): void => {
  if (interstitialManager) {
    interstitialManager.destroy();
    interstitialManager = null;
  }
};
