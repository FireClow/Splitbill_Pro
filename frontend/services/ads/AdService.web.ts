import { Platform } from 'react-native';
import { MVP_FLAGS } from '../../constants/mvpFlags';

interface AdConfig {
  isProduction: boolean;
  isPremiumUser: boolean;
  isEnabled: boolean;
}

export const getAdMobId = (_adType: 'banner' | 'interstitial' | 'rewarded'): string => '';

export const shouldShowAds = (config: AdConfig): boolean => {
  if (!MVP_FLAGS.enableAds) {
    return false;
  }

  return Platform.OS !== 'web' && config.isProduction && !config.isPremiumUser && config.isEnabled;
};

export class InterstitialAdManager {
  public async trackBillCreation(): Promise<void> {}

  public async show(): Promise<void> {}

  public getFrequencyCount(): number {
    return 0;
  }

  public setFrequency(_frequency: number): void {}

  public destroy(): void {}
}

export class RewardedAdManager {
  public async showForReward(): Promise<boolean> {
    return false;
  }

  public isReady(): boolean {
    return false;
  }

  public destroy(): void {}
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
