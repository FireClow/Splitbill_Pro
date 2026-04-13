import { Platform } from 'react-native';
import { AdEventType, InterstitialAd, RewardedAd, RewardedAdEventType } from 'react-native-google-mobile-ads';
import { logger } from '../../utils/logger';
import { MVP_FLAGS } from '../../constants/mvpFlags';
import { getAdRequestOptions, getAdUnitId, isTestAdUnitId, shouldUseTestIds } from './AdMobConfig';

interface AdConfig {
  isProduction: boolean;
  isPremiumUser: boolean;
  isEnabled: boolean;
}

type AdType = 'banner' | 'interstitial' | 'rewarded';

export const getAdMobId = (adType: AdType): string => {
  return getAdUnitId(adType);
};

export const shouldShowAds = (config: AdConfig): boolean => {
  if (!MVP_FLAGS.enableAds) {
    return false;
  }

  if (Platform.OS === 'web' || config.isPremiumUser || !config.isEnabled) {
    return false;
  }

  if (!config.isProduction) {
    return shouldUseTestIds();
  }

  return true;
};

const classifyAdError = (error: unknown): 'no-fill' | 'network' | 'unknown' => {
  const payload = error as { code?: string; message?: string } | undefined;
  const code = payload?.code?.toLowerCase() ?? '';

  if (code.includes('no-fill') || code === '3') {
    return 'no-fill';
  }

  if (code.includes('network') || code === '2') {
    return 'network';
  }

  return 'unknown';
};

const canRequestAds = (adType: AdType): boolean => {
  const adUnitId = getAdMobId(adType);
  if (!adUnitId) {
    logger.warn('AdService', `${adType} ad id is missing`);
    return false;
  }

  if (!__DEV__ && isTestAdUnitId(adUnitId)) {
    logger.error('AdService', `${adType} ad id is still test id in production`, adUnitId);
    return false;
  }

  return true;
};

export class InterstitialAdManager {
  private interstitialAd: InterstitialAd | null = null;
  private isLoaded = false;
  private isShowing = false;
  private adUnitId: string;
  private billCreationCount = 0;
  private showFrequency = 3;
  private unsubscribeListeners: Array<() => void> = [];
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.adUnitId = getAdMobId('interstitial');
    if (Platform.OS === 'web' || !canRequestAds('interstitial')) {
      return;
    }
    this.loadAd();
  }

  private loadAd(): void {
    if (Platform.OS === 'web' || !canRequestAds('interstitial')) {
      return;
    }

    try {
      this.unsubscribeListeners.forEach((unsubscribe) => unsubscribe());
      this.unsubscribeListeners = [];
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }

      this.interstitialAd = InterstitialAd.createForAdRequest(this.adUnitId, getAdRequestOptions());

      this.unsubscribeListeners.push(
        this.interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
          this.isLoaded = true;
        })
      );

      this.unsubscribeListeners.push(
        this.interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
          this.isLoaded = false;
          const category = classifyAdError(error);
          logger.warn('AdService', `Interstitial failed (${category}). Retrying`, error);
          this.retryTimeout = setTimeout(() => this.loadAd(), 3000);
        })
      );

      this.unsubscribeListeners.push(
        this.interstitialAd.addAdEventListener(AdEventType.OPENED, () => {
          this.isShowing = true;
        })
      );

      this.unsubscribeListeners.push(
        this.interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
          this.isShowing = false;
          this.resetFrequency();
          this.loadAd();
        })
      );

      this.interstitialAd.load();
    } catch (error) {
      logger.warn('AdService', 'Interstitial creation error', error);
    }
  }

  public async trackBillCreation(): Promise<void> {
    this.billCreationCount += 1;

    if (this.billCreationCount >= this.showFrequency) {
      await this.show();
    }
  }

  public async show(): Promise<void> {
    if (!this.isLoaded || this.isShowing) {
      return;
    }

    try {
      this.interstitialAd?.show();
    } catch (error) {
      logger.warn('AdService', 'Interstitial show error', error);
      this.resetFrequency();
    }
  }

  private resetFrequency(): void {
    this.billCreationCount = 0;
  }

  public getFrequencyCount(): number {
    return this.billCreationCount;
  }

  public setFrequency(frequency: number): void {
    this.showFrequency = Math.max(1, Math.floor(frequency));
  }

  public destroy(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.unsubscribeListeners.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeListeners = [];
    this.interstitialAd = null;
    this.isLoaded = false;
    this.isShowing = false;
  }
}

export class RewardedAdManager {
  private rewardedAd: RewardedAd | null = null;
  private isLoaded = false;
  private isShowing = false;
  private rewardEarned = false;
  private adUnitId: string;
  private unsubscribeListeners: Array<() => void> = [];
  private pendingResolve: ((value: boolean) => void) | null = null;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.adUnitId = getAdMobId('rewarded');
    if (Platform.OS === 'web' || !canRequestAds('rewarded')) {
      return;
    }

    this.loadAd();
  }

  private loadAd(): void {
    if (Platform.OS === 'web' || !canRequestAds('rewarded')) {
      return;
    }

    this.unsubscribeListeners.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeListeners = [];
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    this.rewardedAd = RewardedAd.createForAdRequest(this.adUnitId, getAdRequestOptions());

    this.unsubscribeListeners.push(
      this.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        this.isLoaded = true;
      })
    );

    this.unsubscribeListeners.push(
      this.rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        this.rewardEarned = true;
      })
    );

    this.unsubscribeListeners.push(
      this.rewardedAd.addAdEventListener(AdEventType.ERROR, (error) => {
        this.isLoaded = false;
        this.isShowing = false;
        const category = classifyAdError(error);
        logger.warn('AdService', `Rewarded failed (${category}). Retrying`, error);
        if (this.pendingResolve) {
          this.pendingResolve(false);
          this.pendingResolve = null;
        }
        this.retryTimeout = setTimeout(() => this.loadAd(), 3000);
      })
    );

    this.unsubscribeListeners.push(
      this.rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
        this.isShowing = false;
        this.isLoaded = false;
        if (this.pendingResolve) {
          this.pendingResolve(this.rewardEarned);
          this.pendingResolve = null;
        }
        this.rewardEarned = false;
        this.loadAd();
      })
    );

    this.rewardedAd.load();
  }

  public async showForReward(): Promise<boolean> {
    if (Platform.OS === 'web' || !canRequestAds('rewarded')) {
      return false;
    }

    if (this.isShowing) {
      return false;
    }

    if (!this.isLoaded || !this.rewardedAd) {
      this.loadAd();
      return false;
    }

    this.isShowing = true;
    this.rewardEarned = false;

    return new Promise<boolean>((resolve) => {
      this.pendingResolve = resolve;
      try {
        this.rewardedAd?.show();
      } catch (error) {
        this.pendingResolve = null;
        this.isShowing = false;
        resolve(false);
        logger.warn('AdService', 'Rewarded show error', error);
      }
    });
  }

  public isReady(): boolean {
    return this.isLoaded;
  }

  public destroy(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.unsubscribeListeners.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeListeners = [];
    this.rewardedAd = null;
    this.isLoaded = false;
    this.isShowing = false;
    this.pendingResolve = null;
    this.rewardEarned = false;
  }
}

let interstitialManager: InterstitialAdManager | null = null;
let rewardedManager: RewardedAdManager | null = null;

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

export const getRewardedAdManager = (): RewardedAdManager => {
  if (!rewardedManager) {
    rewardedManager = new RewardedAdManager();
  }
  return rewardedManager;
};

export const destroyRewardedAdManager = (): void => {
  if (rewardedManager) {
    rewardedManager.destroy();
    rewardedManager = null;
  }
};
