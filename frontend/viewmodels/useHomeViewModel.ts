import { useCallback, useEffect, useMemo, useState } from 'react';
import { BillRepository, BillSummary, DashboardStats } from '../repositories/billRepository';

export const useHomeViewModel = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bills, setBills] = useState<BillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [statsData, billsData] = await Promise.all([
        BillRepository.fetchDashboardStats(),
        BillRepository.fetchBills(),
      ]);
      setStats(statsData);
      setBills(billsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const recentBills = useMemo(() => bills.slice(0, 5), [bills]);

  return {
    stats,
    recentBills,
    loading,
    refreshing,
    error,
    loadData,
    refresh,
  };
};
