import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api, ApiError } from '../../utils/api';
import { Colors } from '../../utils/colors';
import { useAuth } from '../../contexts/AuthContext';
import BannerAd from '../../components/BannerAd';

interface DashboardStats {
  total_bills: number;
  active_bills: number;
  settled_bills: number;
  total_amount: number;
  outstanding: number;
  total_paid: number;
  currency?: string; // Preferred currency from user settings
}

interface Bill {
  bill_id: string;
  title: string;
  currency: string;
  total_amount: number;
  status: string;
  participants: any[];
  splits: any[];
  created_at: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const [statsData, billsData] = await Promise.all([
        api.getDashboardStats(),
        api.getBills(),
      ]);

      if (statsData) {
        setStats(statsData);
      }

      if (Array.isArray(billsData)) {
        setRecentBills(billsData.slice(0, 5));
      } else if (billsData && Array.isArray(billsData.bills)) {
        setRecentBills(billsData.bills.slice(0, 5));
      }
    } catch (err) {
      const message =
        (err instanceof ApiError && err.message) ||
        (err instanceof Error && err.message) ||
        'Failed to load dashboard';
      setError(message);
      console.error('[Home] Error loading data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = (): void => {
    setRefreshing(true);
    loadData();
  };

  const getStatusColor = (status: string): string => {
    if (status === 'settled') return Colors.success;
    if (status === 'active') return Colors.primary;
    return Colors.muted;
  };

  const formatCurrency = (amount: number, currency: string = 'USD'): string => {
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator testID="home-loading" size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>SplitBill</Text>
          </View>
          <View style={styles.avatarContainer}>
            <Ionicons name="receipt-outline" size={24} color={Colors.primaryForeground} />
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Text style={styles.statLabel}>OUTSTANDING</Text>
            <View style={styles.currencyRow}>
              <Text style={styles.currencyCode}>{stats?.currency || 'USD'}</Text>
              <Text style={styles.statValuePrimary}>{(stats?.outstanding || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
            <Text style={styles.statSubtext}>{stats?.active_bills || 0} active bills</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCardSmall}>
              <Ionicons name="receipt-outline" size={20} color={Colors.primary} />
              <Text style={styles.statSmallValue}>{stats?.total_bills || 0}</Text>
              <Text style={styles.statSmallLabel}>Total Bills</Text>
            </View>
            <View style={styles.statCardSmall}>
              <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
              <Text style={styles.statSmallValue}>{stats?.settled_bills || 0}</Text>
              <Text style={styles.statSmallLabel}>Settled</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            testID="create-bill-btn"
            style={styles.actionButton}
            onPress={() => router.push('/create-bill')}
          >
            <View style={styles.actionButtonIcon}>
              <Ionicons name="add-circle" size={24} color={Colors.primary} />
            </View>
            <View style={styles.actionButtonContent}>
              <Text style={styles.actionButtonTitle}>Create Bill</Text>
              <Text style={styles.actionButtonDesc}>Manual entry</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="scan-receipt-btn"
            style={styles.actionButton}
            onPress={() => router.push('/scan-receipt')}
          >
            <View style={styles.actionButtonIcon}>
              <MaterialCommunityIcons name="camera" size={24} color={Colors.primary} />
            </View>
            <View style={styles.actionButtonContent}>
              <Text style={styles.actionButtonTitle}>Scan Receipt</Text>
              <Text style={styles.actionButtonDesc}>Auto OCR</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Bills</Text>
          <TouchableOpacity
            testID="view-all-bills-btn"
            onPress={() => router.push('/(tabs)/bills')}
          >
            <Text style={styles.sectionLink}>View all</Text>
          </TouchableOpacity>
        </View>

        {recentBills.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={Colors.muted} />
            <Text style={styles.emptyText}>No bills yet</Text>
            <Text style={styles.emptySubtext}>Create your first bill to get started</Text>
          </View>
        ) : (
          recentBills.map((bill) => (
            <TouchableOpacity
              key={bill.bill_id}
              testID={`bill-card-${bill.bill_id}`}
              style={styles.billCard}
              onPress={() => router.push(`/bill/${bill.bill_id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.billCardLeft}>
                <View
                  style={[
                    styles.billStatus,
                    { backgroundColor: `${getStatusColor(bill.status)}20` },
                  ]}
                >
                  <View
                    style={[
                      styles.billStatusDot,
                      { backgroundColor: getStatusColor(bill.status) },
                    ]}
                  />
                </View>
                <View style={styles.billInfo}>
                  <Text style={styles.billTitle} numberOfLines={1}>
                    {bill.title}
                  </Text>
                  <Text style={styles.billMeta}>
                    {bill.participants?.length || 0} people · {bill.status}
                  </Text>
                </View>
              </View>
              <View style={styles.billCardRight}>
                <Text style={styles.billAmount}>
                  {formatCurrency(bill.total_amount, bill.currency)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        testID="create-bill-fab"
        style={styles.fab}
        onPress={() => router.push('/create-bill')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={Colors.primaryForeground} />
      </TouchableOpacity>

      <BannerAd isPremium={user?.isPremium} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 32,
  },
  greeting: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  userName: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -1,
    marginTop: 4,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primaryForeground,
  },
  statsGrid: {
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statCardPrimary: {
    borderColor: `${Colors.primary}40`,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  currencyCode: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statValuePrimary: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -1.5,
  },
  statSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statCardSmall: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'flex-start',
    gap: 8,
  },
  statSmallValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
  },
  statSmallLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.white,
    letterSpacing: -0.25,
  },
  sectionLink: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  billCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  billCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  billStatus: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  billStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  billInfo: {
    flex: 1,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  billMeta: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  billCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  billAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.primaryForeground,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  actionButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonContent: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  actionButtonDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
