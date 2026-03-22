import { BillRepository, BillSummary, DashboardStats } from '../../repositories/billRepository';

interface CreateBillPayload {
  title: string;
  currency: string;
  items: Array<{ name: string; price: number; quantity: number }>;
  participants: Array<{ name: string; contact_info?: string; client_id?: string }>;
  tax_type?: 'percentage' | 'fixed';
  tax_value?: number;
  service_charge?: number;
  split_method?: string;
}

export const mvpBillUseCases = {
  async loadHistory(): Promise<BillSummary[]> {
    return BillRepository.fetchBills();
  },

  async loadDashboard(): Promise<DashboardStats> {
    return BillRepository.fetchDashboardStats();
  },

  async createBill(payload: CreateBillPayload): Promise<{ bill_id: string }> {
    return BillRepository.createBill(payload);
  },
};
