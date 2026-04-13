import { api } from '../utils/api';
import { transactionHistoryStore } from '../data/local/transactionHistoryStore';

export interface BillSummary {
  bill_id: string;
  title: string;
  currency: string;
  total_amount: number;
  status: string;
  participants: any[];
  created_at: string;
}

export interface DashboardStats {
  total_bills: number;
  active_bills: number;
  settled_bills: number;
  total_amount: number;
  outstanding: number;
  total_paid: number;
  currency?: string;
}

interface BillCreatePayload {
  title: string;
  currency: string;
  items: { name: string; price: number; quantity: number }[];
  participants: { name: string; contact_info?: string }[];
}

const normalizeBills = (payload: any): BillSummary[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.bills)) {
    return payload.bills;
  }

  return [];
};

const mergeUniqueBills = (primary: BillSummary[], secondary: BillSummary[]): BillSummary[] => {
  const byId = new Map<string, BillSummary>();

  [...secondary, ...primary].forEach((bill) => {
    if (!bill?.bill_id) {
      return;
    }
    byId.set(bill.bill_id, bill);
  });

  return [...byId.values()].sort((a, b) => {
    const aTime = new Date(a.created_at || 0).getTime();
    const bTime = new Date(b.created_at || 0).getTime();
    return bTime - aTime;
  });
};

const buildLocalSummaryFromCreate = (
  billId: string,
  payload: BillCreatePayload
): BillSummary => {
  const total = payload.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  return {
    bill_id: billId,
    title: payload.title,
    currency: payload.currency || 'USD',
    total_amount: total,
    status: 'active',
    participants: payload.participants || [],
    created_at: new Date().toISOString(),
  };
};

const deriveStatsFromBills = (bills: BillSummary[]): DashboardStats => {
  const active = bills.filter((bill) => bill.status === 'active');
  const settled = bills.filter((bill) => bill.status === 'settled');

  const totalAmount = bills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0);
  const outstanding = active.reduce((sum, bill) => sum + (bill.total_amount || 0), 0);
  const totalPaid = settled.reduce((sum, bill) => sum + (bill.total_amount || 0), 0);

  return {
    total_bills: bills.length,
    active_bills: active.length,
    settled_bills: settled.length,
    total_amount: totalAmount,
    outstanding,
    total_paid: totalPaid,
    currency: bills[0]?.currency || 'USD',
  };
};

export const BillRepository = {
  async fetchBills(): Promise<BillSummary[]> {
    const localBills = await transactionHistoryStore.getAll();
    try {
      const response = await api.getBills();
      const remoteBills = normalizeBills(response);
      const merged = mergeUniqueBills(remoteBills, localBills);
      await transactionHistoryStore.replaceAll(merged);
      return merged;
    } catch {
      return localBills;
    }
  },

  async createBill(data: BillCreatePayload): Promise<{ bill_id: string }> {
    const result = await api.createBill(data as Record<string, any>);
    const billId = result?.bill_id;

    if (billId) {
      const summary = buildLocalSummaryFromCreate(billId, data);
      await transactionHistoryStore.upsert(summary);
    }

    return result;
  },

  async fetchDashboardStats(): Promise<DashboardStats> {
    const localBills = await transactionHistoryStore.getAll();
    try {
      const response = await api.getDashboardStats();
      return response as DashboardStats;
    } catch {
      return deriveStatsFromBills(localBills);
    }
  },
};
