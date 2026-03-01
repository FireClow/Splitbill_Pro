import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../utils/api';
import { Colors } from '../../utils/colors';

interface SpendingMonth {
  month: string;
  total: number | null;
  locked?: boolean;
}

interface CurrencyData {
  currency: string;
  total: number;
}

interface AnalyticsSummary {
  total_spent: number;
  total_bills: number;
  average_bill: number;
  total_participants: number;
  most_used_currency: string;
}

export default function AnalyticsScreen() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [spending, setSpending] = useState<SpendingMonth[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const [summaryData, spendingData, currencyData] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getAnalyticsSpending(),
        api.getAnalyticsCurrencies(),
      ]);

      if (summaryData) {
        setSummary(summaryData);
      }
      if (spendingData && Array.isArray(spendingData.spending)) {
        setSpending(spendingData.spending);
      }
      if (currencyData && Array.isArray(currencyData.currencies)) {
        setCurrencies(currencyData.currencies);
      }
    } catch (err) {
      const message =
        (err instanceof ApiError && err.message) ||
        (err instanceof Error && err.message) ||
        'Failed to load analytics';
      setError(message);
      console.error('[Analytics] Error loading data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const maxSpending = Math.max(
    ...(spending
      .filter((s) => s.total !== null)
      .map((s) => s.total) as number[]),
    1
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator testID="analytics-loading" size="large" color={Colors.primary} />
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
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics</Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Ionicons name="wallet-outline" size={24} color={Colors.primary} />
            <Text style={styles.summaryValue}>${summary?.total_spent?.toFixed(2) || '0.00'}</Text>
            <Text style={styles.summaryLabel}>TOTAL SPENT</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="receipt-outline" size={24} color={Colors.info} />
            <Text style={styles.summaryValue}>{summary?.total_bills || 0}</Text>
            <Text style={styles.summaryLabel}>TOTAL BILLS</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="trending-up-outline" size={24} color={Colors.success} />
            <Text style={styles.summaryValue}>${summary?.average_bill?.toFixed(2) || '0.00'}</Text>
            <Text style={styles.summaryLabel}>AVG BILL</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="people-outline" size={24} color={Colors.warning} />
            <Text style={styles.summaryValue}>{summary?.total_participants || 0}</Text>
            <Text style={styles.summaryLabel}>PARTICIPANTS</Text>
          </View>
        </View>

        {/* Monthly Spending Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Spending</Text>
          <View style={styles.chartContainer}>
            {spending.length === 0 ? (
              <Text style={styles.emptyText}>No spending data yet</Text>
            ) : (
              spending.map((item, index) => (
                <View key={index} style={styles.barRow}>
                  <Text style={styles.barLabel}>{item.month}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${((item.total || 0) / maxSpending) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.barValue}>${(item.total || 0).toFixed(0)}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Currency Distribution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Currency Distribution</Text>
          <View style={styles.currencyList}>
            {currencies.length === 0 ? (
              <Text style={styles.emptyText}>No currency data yet</Text>
            ) : (
              currencies.map((item, index) => {
                const maxCurrency = Math.max(...currencies.map((c) => c.total), 1);
                return (
                  <View key={index} style={styles.currencyRow}>
                    <View style={styles.currencyFlag}>
                      <Text style={styles.currencyFlagText}>{item.currency}</Text>
                    </View>
                    <View style={styles.currencyBarContainer}>
                      <View
                        style={[
                          styles.currencyBar,
                          { width: `${(item.total / maxCurrency) * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.currencyValue}>${item.total.toFixed(2)}</Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
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
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -1,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    flexGrow: 1,
    flexBasis: '45%',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.white,
    letterSpacing: -0.25,
    marginBottom: 16,
  },
  chartContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barLabel: {
    width: 60,
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  barTrack: {
    flex: 1,
    height: 28,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: 28,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  barValue: {
    width: 60,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'right',
  },
  currencyList: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currencyFlag: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyFlagText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  currencyBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  currencyBar: {
    height: 8,
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  currencyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    width: 80,
    textAlign: 'right',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
    paddingVertical: 16,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginTop: 16,
  },
});
