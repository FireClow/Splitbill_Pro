import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BONUS_SCAN_CREDITS_STORAGE_KEY, FREE_SCAN_DAILY_LIMIT, SCAN_USAGE_STORAGE_KEY } from '../constants/monetization';
import { useSubscription } from '../contexts/SubscriptionContext';

interface UsageState {
  used: number;
  remaining: number;
  bonusCredits: number;
  resetAt: number | null;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

const readUsageTimestamps = async (): Promise<number[]> => {
  const raw = await AsyncStorage.getItem(SCAN_USAGE_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as number[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value) => Number.isFinite(value));
  } catch {
    return [];
  }
};

const pruneUsageWindow = (timestamps: number[], now: number): number[] => {
  return timestamps.filter((value) => now - value < WINDOW_MS);
};

const saveUsageTimestamps = async (timestamps: number[]): Promise<void> => {
  await AsyncStorage.setItem(SCAN_USAGE_STORAGE_KEY, JSON.stringify(timestamps));
};

const readBonusCredits = async (): Promise<number> => {
  const raw = await AsyncStorage.getItem(BONUS_SCAN_CREDITS_STORAGE_KEY);
  if (!raw) {
    return 0;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
};

const saveBonusCredits = async (credits: number): Promise<void> => {
  await AsyncStorage.setItem(BONUS_SCAN_CREDITS_STORAGE_KEY, String(Math.max(0, credits)));
};

const toUsageState = (timestamps: number[], isPremium: boolean, bonusCredits: number): UsageState => {
  if (isPremium) {
    return {
      used: timestamps.length,
      remaining: Number.MAX_SAFE_INTEGER,
      bonusCredits: 0,
      resetAt: null,
    };
  }

  const used = Math.min(FREE_SCAN_DAILY_LIMIT, timestamps.length);
  const remaining = Math.max(0, FREE_SCAN_DAILY_LIMIT - used) + Math.max(0, bonusCredits);
  const oldest = timestamps.length > 0 ? Math.min(...timestamps) : null;

  return {
    used,
    remaining,
    bonusCredits: Math.max(0, bonusCredits),
    resetAt: oldest ? oldest + WINDOW_MS : null,
  };
};

export const useUsageLimit = () => {
  const { isPremium } = useSubscription();
  const [usage, setUsage] = useState<UsageState>({
    used: 0,
    remaining: FREE_SCAN_DAILY_LIMIT,
    bonusCredits: 0,
    resetAt: null,
  });
  const [loading, setLoading] = useState(true);

  const refreshUsage = useCallback(async () => {
    const now = Date.now();
    const timestamps = pruneUsageWindow(await readUsageTimestamps(), now);
    const bonusCredits = await readBonusCredits();
    await saveUsageTimestamps(timestamps);
    setUsage(toUsageState(timestamps, isPremium, bonusCredits));
    setLoading(false);
  }, [isPremium]);

  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  const consumeScan = useCallback(async (): Promise<boolean> => {
    if (isPremium) {
      return true;
    }

    const now = Date.now();
    const timestamps = pruneUsageWindow(await readUsageTimestamps(), now);
    const bonusCredits = await readBonusCredits();

    if (timestamps.length >= FREE_SCAN_DAILY_LIMIT) {
      if (bonusCredits <= 0) {
        setUsage(toUsageState(timestamps, false, 0));
        return false;
      }

      const updatedCredits = bonusCredits - 1;
      await saveBonusCredits(updatedCredits);
      setUsage(toUsageState(timestamps, false, updatedCredits));
      return true;
    }

    const updated = [...timestamps, now];
    await saveUsageTimestamps(updated);
    setUsage(toUsageState(updated, false, bonusCredits));
    return true;
  }, [isPremium]);

  const grantBonusScan = useCallback(async (amount: number = 1): Promise<void> => {
    if (isPremium) {
      return;
    }

    const safeAmount = Math.max(1, Math.floor(amount));
    const currentCredits = await readBonusCredits();
    const updatedCredits = currentCredits + safeAmount;
    await saveBonusCredits(updatedCredits);

    const now = Date.now();
    const timestamps = pruneUsageWindow(await readUsageTimestamps(), now);
    await saveUsageTimestamps(timestamps);
    setUsage(toUsageState(timestamps, false, updatedCredits));
  }, [isPremium]);

  return {
    loading,
    usage,
    canScan: isPremium || usage.remaining > 0,
    isPremium,
    dailyLimit: FREE_SCAN_DAILY_LIMIT,
    refreshUsage,
    consumeScan,
    grantBonusScan,
    nextResetAt: usage.resetAt,
    remainingScans: usage.remaining,
    bonusScans: usage.bonusCredits,
  };
};

export type UseUsageLimitResult = ReturnType<typeof useUsageLimit>;
