import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';
import { Colors } from '../utils/colors';
import { useAuth } from '../contexts/AuthContext';
import { MVP_FLAGS } from '../constants/mvpFlags';

const CURRENCIES_DATA = [
  { code: 'USD', country: 'United States' },
  { code: 'EUR', country: 'Eurozone' },
  { code: 'GBP', country: 'United Kingdom' },
  { code: 'JPY', country: 'Japan' },
  { code: 'CHF', country: 'Switzerland' },
  { code: 'CAD', country: 'Canada' },
  { code: 'AUD', country: 'Australia' },
  { code: 'NZD', country: 'New Zealand' },
  { code: 'CNY', country: 'China' },
  { code: 'INR', country: 'India' },
  { code: 'SGD', country: 'Singapore' },
  { code: 'HKD', country: 'Hong Kong' },
  { code: 'KRW', country: 'South Korea' },
  { code: 'MXN', country: 'Mexico' },
  { code: 'BRL', country: 'Brazil' },
  { code: 'ZAR', country: 'South Africa' },
  { code: 'SEK', country: 'Sweden' },
  { code: 'NOK', country: 'Norway' },
  { code: 'DKK', country: 'Denmark' },
  { code: 'THB', country: 'Thailand' },
  { code: 'IDR', country: 'Indonesia' },
  { code: 'MYR', country: 'Malaysia' },
  { code: 'PHP', country: 'Philippines' },
  { code: 'TWD', country: 'Taiwan' },
  { code: 'TRY', country: 'Turkey' },
  { code: 'PLN', country: 'Poland' },
  { code: 'CZK', country: 'Czech Republic' },
  { code: 'HUF', country: 'Hungary' },
  { code: 'ILS', country: 'Israel' },
  { code: 'AED', country: 'United Arab Emirates' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const currencyFeatureEnabled = MVP_FLAGS.enableCurrencyConverter;
  const [preferredCurrency, setPreferredCurrency] = useState(user?.preferred_currency || 'USD');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currencyFeatureEnabled) {
      return;
    }
    loadPreferences();
  }, [currencyFeatureEnabled]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await api.getUserPreferences();
      setPreferredCurrency(prefs.preferred_currency || 'USD');
    } catch (error) {
      console.error('[Settings] Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCurrencySelect = async (currency: string) => {
    if (currency === preferredCurrency) return;

    try {
      setSaving(true);
      await api.updateUserPreferences({ preferred_currency: currency });
      setPreferredCurrency(currency);
      Alert.alert('Success', `Preferred currency updated to ${currency}`);
    } catch (error) {
      console.error('[Settings] Error updating currency:', error);
      Alert.alert('Error', 'Failed to update preferred currency');
    } finally {
      setSaving(false);
    }
  };

  if (!currencyFeatureEnabled) {
    // TODO: Future feature (disabled for MVP)
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="construct-outline" size={48} color={Colors.warning} />
          <Text style={{ color: Colors.white, marginTop: 12, fontSize: 16 }}>
            Currency settings is temporarily disabled for MVP.
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { marginTop: 16 }]}> 
            <Ionicons name="chevron-back" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Currency Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Current Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Currency</Text>
          <View style={styles.currencyDisplay}>
            <View style={styles.currencyFlag}>
              <Text style={styles.currencyFlagText}>{preferredCurrency}</Text>
            </View>
            <View style={styles.currencyInfo}>
              <Text style={styles.currencyName}>
                {getCurrencyName(preferredCurrency)}
              </Text>
              <Text style={styles.currencySubtext}>
                All amounts in analytics and outstanding will be shown in this currency
              </Text>
            </View>
          </View>
        </View>

        {/* Currency List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Currency</Text>
          <View style={styles.currencyListContainer}>
            <FlatList
              data={CURRENCIES_DATA}
              keyExtractor={(item) => item.code}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              renderItem={({ item }) => (
                <TouchableOpacity
                  disabled={saving}
                  style={[
                    styles.currencyItem,
                    preferredCurrency === item.code && styles.currencyItemActive,
                  ]}
                  onPress={() => handleCurrencySelect(item.code)}
                >
                  <View style={styles.currencyItemContent}>
                    <Text style={[
                      styles.currencyItemCode,
                      preferredCurrency === item.code && styles.currencyItemCodeActive,
                    ]}>
                      {item.code}
                    </Text>
                    <Text style={styles.currencyItemCountry}>
                      {item.country}
                    </Text>
                  </View>
                  {preferredCurrency === item.code && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>

        {/* Info */}
        <View style={styles.section}>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.info} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>How this works</Text>
              <Text style={styles.infoText}>
                Your bills can be in different currencies. Your preferred currency is used to display:
              </Text>
              <Text style={styles.infoBullet}>• Outstanding amount on home screen</Text>
              <Text style={styles.infoBullet}>• Analytics and spending charts</Text>
              <Text style={styles.infoBullet}>• Total amounts in dashboard</Text>
              <Text style={[styles.infoText, { marginTop: 12 }]}>
                Conversion rates are fetched automatically and cached for 1 hour.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getCurrencyName(code: string): string {
  const currency = CURRENCIES_DATA.find((c) => c.code === code);
  return currency ? currency.country : code;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -0.5,
    textAlign: 'center',
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  currencyDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 16,
  },
  currencyFlag: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyFlagText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primaryForeground,
    letterSpacing: -0.5,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
  },
  currencySubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  currencyListContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    height: 300,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  currencyItemActive: {
    backgroundColor: `${Colors.primary}15`,
  },
  currencyItemContent: {
    flex: 1,
  },
  currencyItemCode: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 2,
  },
  currencyItemCodeActive: {
    color: Colors.primary,
  },
  currencyItemCountry: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  infoBullet: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
    marginLeft: 8,
  },
});
