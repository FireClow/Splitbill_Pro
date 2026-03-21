import { api } from '../utils/api';

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

const normalizeBills = (payload: any): BillSummary[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.bills)) {
    return payload.bills;
  }

  return [];
};

export const BillRepository = {
  async fetchBills(): Promise<BillSummary[]> {
    const response = await api.getBills();
    return normalizeBills(response);
  },

  async fetchDashboardStats(): Promise<DashboardStats> {
    const response = await api.getDashboardStats();
    return response as DashboardStats;
  },
};
