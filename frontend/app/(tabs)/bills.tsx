import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../utils/api';
import { Colors } from '../../utils/colors';

interface Bill {
  bill_id: string;
  title: string;
  currency: string;
  total_amount: number;
  status: string;
  participants: any[];
  created_at: string;
}

export default function BillsScreen() {
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'settled'>('all');

  const loadBills = useCallback(async () => {
    try {
      const data = await api.getBills();
      setBills(data.bills || data);
    } catch (err) {
      console.error('Failed to load bills:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadBills(); }, [loadBills]);

  const filteredBills = bills.filter((b) => {
    const matchSearch = b.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || b.status === filter;
    return matchSearch && matchFilter;
  });

  const getStatusColor = (status: string) => {
    if (status === 'settled') return Colors.success;
    if (status === 'active') return Colors.primary;
    return Colors.muted;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator testID="bills-loading" size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bills</Text>
        <TouchableOpacity testID="create-bill-btn" style={styles.addBtn} onPress={() => router.push('/create-bill')}>
          <Ionicons name="add" size={24} color={Colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={Colors.muted} />
        <TextInput
          testID="bills-search-input"
          style={styles.searchInput}
          placeholder="Search bills..."
          placeholderTextColor={Colors.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterRow}>
        {(['all', 'active', 'settled'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            testID={`filter-${f}-btn`}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadBills(); }} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredBills.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={Colors.muted} />
            <Text style={styles.emptyText}>{search ? 'No bills found' : 'No bills yet'}</Text>
          </View>
        ) : (
          filteredBills.map((bill) => (
            <TouchableOpacity
              key={bill.bill_id}
              testID={`bill-item-${bill.bill_id}`}
              style={styles.billCard}
              onPress={() => router.push(`/bill/${bill.bill_id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.billRow}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(bill.status) + '20' }]}>
                  <Ionicons
                    name={bill.status === 'settled' ? 'checkmark-circle' : 'time-outline'}
                    size={20}
                    color={getStatusColor(bill.status)}
                  />
                </View>
                <View style={styles.billInfo}>
                  <Text style={styles.billTitle} numberOfLines={1}>{bill.title}</Text>
                  <Text style={styles.billMeta}>
                    {bill.participants?.length || 0} people · {new Date(bill.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.billRight}>
                  <Text style={styles.billAmount}>{bill.currency} {(bill.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  <View style={[styles.statusTag, { backgroundColor: getStatusColor(bill.status) + '20' }]}>
                    <Text style={[styles.statusTagText, { color: getStatusColor(bill.status) }]}>{bill.status}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '700', color: Colors.white, letterSpacing: -1 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, paddingHorizontal: 16, marginHorizontal: 24, marginBottom: 16, height: 48, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  searchInput: { flex: 1, color: Colors.white, fontSize: 16 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 16, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  filterText: { fontSize: 14, fontWeight: '500', color: Colors.muted },
  filterTextActive: { color: Colors.primary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 100 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 16, color: Colors.muted, fontWeight: '500' },
  billCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  billRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statusBadge: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  billInfo: { flex: 1 },
  billTitle: { fontSize: 16, fontWeight: '600', color: Colors.white },
  billMeta: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  billRight: { alignItems: 'flex-end', gap: 4 },
  billAmount: { fontSize: 16, fontWeight: '700', color: Colors.white },
  statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusTagText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});
