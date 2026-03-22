import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../utils/colors';
import { LEGAL_LINKS } from '../constants/legalLinks';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const handleGuestContinue = async () => {
    const platformPrefix = Platform.OS === 'web' ? 'web' : 'mobile';
    const sessionId = `${platformPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await login(sessionId);
    router.replace('/(tabs)/home');
  };

  const openLegalLink = async (url: string, label: string): Promise<void> => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Unavailable', `${label} link is not available right now.`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unavailable', `${label} link is not available right now.`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <Ionicons name="receipt-outline" size={56} color={Colors.primary} />
          </View>
          <Text style={styles.title}>SplitBill</Text>
          <Text style={styles.titleAccent}>Pro</Text>
          <Text style={styles.subtitle}>Scan receipts quickly.{"\n"}Split bills and save local history.</Text>
        </View>

        <View style={styles.features}>
          {[
            { icon: 'scan-outline' as const, text: 'OCR receipt scanning' },
            { icon: 'calculator-outline' as const, text: 'Split bill calculation' },
            { icon: 'save-outline' as const, text: 'Local transaction history' },
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={20} color={Colors.primary} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.authSection}>
          <TouchableOpacity
            testID="guest-login-btn"
            style={styles.googleButton}
            onPress={handleGuestContinue}
            activeOpacity={0.8}
          >
            <Ionicons name="person-outline" size={22} color="#000" />
            <Text style={styles.googleButtonText}>Continue as Guest</Text>
          </TouchableOpacity>
          <View style={styles.disclaimerRow}>
            <Text style={styles.disclaimer}>By continuing, you agree to our </Text>
            <TouchableOpacity onPress={() => openLegalLink(LEGAL_LINKS.termsOfService, 'Terms of Service')}>
              <Text style={styles.disclaimerLink}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.disclaimer}> and </Text>
            <TouchableOpacity onPress={() => openLegalLink(LEGAL_LINKS.privacyPolicy, 'Privacy Policy')}>
              <Text style={styles.disclaimerLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 32,
  },
  heroSection: {
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -1.5,
    lineHeight: 56,
  },
  titleAccent: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -1.5,
    lineHeight: 56,
    marginTop: -4,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.textSecondary,
    lineHeight: 28,
    marginTop: 16,
  },
  features: {
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 16,
    color: Colors.white,
    fontWeight: '500',
  },
  authSection: {
    gap: 16,
  },
  googleButton: {
    backgroundColor: Colors.white,
    borderRadius: 100,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    letterSpacing: 0.5,
  },
  disclaimer: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  disclaimerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  disclaimerLink: {
    fontSize: 13,
    color: Colors.primary,
    textDecorationLine: 'underline',
    lineHeight: 18,
  },
});
