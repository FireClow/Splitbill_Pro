import { useCallback, useState } from 'react';
import { BillSummary } from '../repositories/billRepository';
import { mvpBillUseCases } from '../domain/usecases/mvpBillUseCases';

export const useBillsViewModel = () => {
  const [bills, setBills] = useState<BillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBills = useCallback(async () => {
    try {
      setError(null);
      const data = await mvpBillUseCases.loadHistory();
      setBills(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load bills';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshBills = useCallback(() => {
    setRefreshing(true);
    loadBills();
  }, [loadBills]);

  return {
    bills,
    loading,
    refreshing,
    error,
    loadBills,
    refreshBills,
  };
};
