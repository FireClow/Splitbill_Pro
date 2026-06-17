import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../utils/api';
import { Colors } from '../../utils/colors';
import { MVP_FLAGS } from '../../constants/mvpFlags';

interface SpendingMonth {
  month: string;
  total: number | null;
  locked?: boolean;
  dateRange?: string; // For weekly format like "1-7", "8-14", etc.
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
  preferred_currency?: string; // User's preferred currency from settings
}

export default function AnalyticsScreen() {
  const analyticsEnabled = MVP_FLAGS.enableAnalytics;

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [spending, setSpending] = useState<SpendingMonth[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Month & date info
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthYear);
  
  // Get current week range for highlighting
  const getCurrentWeekRange = (): string => {
    if (currentDay <= 7) return "1-7";
    if (currentDay <= 14) return "8-14";
    if (currentDay <= 21) return "15-21";
    if (currentDay <= 28) return "22-28";
    return "29-31";
  };

  const loadData = useCallback(async (month?: string): Promise<void> => {
    try {
      setError(null);
      const monthToLoad = month || selectedMonth;
      const [summaryData, spendingData, currencyData] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getAnalyticsSpending(monthToLoad),
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
  }, [selectedMonth]);

  useEffect(() => {
    if (!analyticsEnabled) {
      setLoading(false);
      return;
    }
    loadData();
  }, [analyticsEnabled, loadData]);

  if (!analyticsEnabled) {
    // TODO: Future feature (disabled for MVP)
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="construct-outline" size={48} color={Colors.warning} />
          <Text style={styles.errorText}>Analytics is temporarily disabled for MVP.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const maxSpending = Math.max(
    ...(spending
      .filter((s) => s.total !== null)
      .map((s) => s.total) as number[]),
    1
  );

  // Function to round to nice numbers for Y-axis
  const getNiceMaxValue = (max: number): number => {
    if (max === 0) return 100;
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    const normalized = max / magnitude;
    let nice = 1;
    if (normalized <= 1) nice = 1;
    else if (normalized <= 2) nice = 2;
    else if (normalized <= 5) nice = 5;
    else nice = 10;
    return nice * magnitude;
  };

  // Function to format numbers with thousand separators
  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Function to format month display
  const formatMonthDisplay = (monthStr: string): string => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  // Handle month change
  const handleMonthChange = (offset: number) => {
    const [year, month] = selectedMonth.split('-');
    let newYear = parseInt(year);
    let newMonth = parseInt(month) + offset;
    
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    
    const newMonthStr = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    setSelectedMonth(newMonthStr);
    setRefreshing(true);
    loadData(newMonthStr);
  };

  const niceMaxSpending = getNiceMaxValue(maxSpending);

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
            <View style={styles.summaryValueRow}>
              <Text style={styles.currencyLabel}>{summary?.preferred_currency || 'USD'}</Text>
              <Text style={styles.summaryValue}>{(summary?.total_spent || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
            <Text style={styles.summaryLabel}>TOTAL SPENT</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="receipt-outline" size={24} color={Colors.info} />
            <Text style={styles.summaryValue}>{summary?.total_bills || 0}</Text>
            <Text style={styles.summaryLabel}>TOTAL BILLS</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="trending-up-outline" size={24} color={Colors.success} />
            <View style={styles.summaryValueRow}>
              <Text style={styles.currencyLabel}>{summary?.preferred_currency || 'USD'}</Text>
              <Text style={styles.summaryValue}>{(summary?.average_bill || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
            <Text style={styles.summaryLabel}>AVG BILL</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="people-outline" size={24} color={Colors.warning} />
            <Text style={styles.summaryValue}>{summary?.total_participants || 0}</Text>
            <Text style={styles.summaryLabel}>PARTICIPANTS</Text>
          </View>
        </View>

        {/* Monthly Spending Chart */}
        {/* Monthly Spending Chart */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleColumn}>
              <View style={styles.titleWithBadge}>
                <Text style={styles.sectionTitle}>Monthly Spending</Text>
                {selectedMonth === currentMonthYear && (
                  <View style={styles.currentMonthBadge}>
                    <Text style={styles.currentMonthBadgeText}>TODAY</Text>
                  </View>
                )}
              </View>
              <Text style={styles.monthLabel}>
                {formatMonthDisplay(selectedMonth)}
                {selectedMonth === currentMonthYear && (
                  <Text style={styles.currentDateIndicator}> • {currentDay}</Text>
                )}
              </Text>
            </View>
            <View style={styles.monthSelectorContainer}>
              <TouchableOpacity 
                style={styles.monthButton}
                onPress={() => handleMonthChange(-1)}
              >
                <Ionicons name="chevron-back" size={24} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.monthButton}
                onPress={() => handleMonthChange(1)}
              >
                <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {spending.length === 0 ? (
            <View style={styles.chartContainer}>
              <Text style={styles.emptyText}>No spending data yet</Text>
            </View>
          ) : (
            <>
              {/* Vertical Bar Chart with Grid Lines */}
              <View style={styles.chartContainer}>
                <View style={styles.chartWrapper}>
                  {/* Y-Axis */}
                  <View style={styles.yAxisContainer}>
                    <Text style={styles.yAxisLabel}>{formatNumber(niceMaxSpending)}</Text>
                    <Text style={styles.yAxisLabel}>{formatNumber(niceMaxSpending * 0.75)}</Text>
                    <Text style={styles.yAxisLabel}>{formatNumber(niceMaxSpending * 0.5)}</Text>
                    <Text style={styles.yAxisLabel}>{formatNumber(niceMaxSpending * 0.25)}</Text>
                    <Text style={styles.yAxisLabel}>0</Text>
                  </View>

                  {/* Chart Area */}
                  <View style={styles.chartArea}>
                    {/* Horizontal Grid Lines */}
                    <View style={styles.horizontalGridContainer}>
                      <View style={styles.horizontalGridLine} />
                      <View style={styles.horizontalGridLine} />
                      <View style={styles.horizontalGridLine} />
                      <View style={styles.horizontalGridLine} />
                    </View>

                    {/* Vertical Grid Lines */}
                    <View style={styles.verticalGridContainer}>
                      {spending.map((_, index) => (
                        <View key={`vgrid-${index}`} style={styles.verticalGridLine} />
                      ))}
                    </View>

                    {/* Bars */}
                    <View style={styles.barsWrapper}>
                      {spending.map((item, index) => {
                        const heightPercent = niceMaxSpending > 0 ? ((item.total || 0) / niceMaxSpending * 100) : 0;
                        const isCurrentWeek = selectedMonth === currentMonthYear && item.dateRange === getCurrentWeekRange();
                        return (
                          <View 
                            key={index} 
                            style={[
                              styles.barContainer,
                              isCurrentWeek && styles.currentWeekBarContainer
                            ]}
                          >
                            <View style={styles.barInnerContainer}>
                              <View
                                style={[
                                  styles.verticalBar,
                                  isCurrentWeek && styles.currentWeekBar,
                                  {
                                    height: `${heightPercent}%`,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={styles.barXLabel}>{item.dateRange || item.month}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Summary Below Chart */}
                <View style={styles.chartSummary}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.chartSummaryValue}>
                      {(spending.reduce((sum, item) => sum + (item.total || 0), 0)).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                    <Text style={styles.chartSummaryLabel}>Total Spending</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.chartSummaryValue}>
                      {Math.max(...spending.map(s => s.total || 0)).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                    <Text style={styles.chartSummaryLabel}>Highest Month</Text>
                  </View>
                </View>
              </View>
            </>
          )}
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
                    <Text style={styles.currencyValue}>${item.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
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
  summaryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  currencyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleColumn: {
    flex: 1,
    gap: 2,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentMonthBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  currentMonthBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  currentDateIndicator: {
    color: Colors.success,
    fontWeight: '600',
  },
  monthSelectorContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    backgroundColor: `${Colors.primary}20`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chartContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  chartWrapper: {
    flexDirection: 'row',
    gap: 12,
    height: 380,
  },
  yAxisContainer: {
    width: 45,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 10,
    paddingBottom: 35,
  },
  yAxisLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  chartArea: {
    flex: 1,
    position: 'relative',
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: Colors.border,
    paddingRight: 8,
  },
  gridLinesContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  gridLine: {
    height: 1,
    backgroundColor: Colors.border,
    opacity: 0.4,
  },
  horizontalGridContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  horizontalGridLine: {
    height: 1,
    backgroundColor: Colors.border,
    opacity: 0.4,
    width: '100%',
  },
  verticalGridContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  verticalGridLine: {
    flex: 1,
    width: 1,
    backgroundColor: Colors.border,
    opacity: 0.3,
  },
  barsWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: 35,
    paddingHorizontal: 4,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barInnerContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  verticalBar: {
    width: '100%',
    backgroundColor: '#FFB84D',
    borderRadius: 6,
    minHeight: 2,
  },
  currentWeekBar: {
    backgroundColor: Colors.success,
    boxShadow: `0px 0px 8px ${Colors.success}66`,
  },
  currentWeekBarContainer: {
    borderRadius: 12,
    backgroundColor: `${Colors.success}10`,
    padding: 6,
  },
  barXLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  chartSummary: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  chartSummaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  chartSummaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.3,
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
