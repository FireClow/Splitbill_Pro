import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError, removeToken } from '../../utils/api';
import { Colors } from '../../utils/colors';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel: string;
  route?: string;
}

export default function ProfileScreen() {
  const router = useRouter();

  const handleLogout = (): void => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.logout();
          } catch (error) {
            console.error('[Profile] Logout API call failed:', error);
          } finally {
            await removeToken();
            router.replace('/');
          }
        },
      },
    ]);
  };

  const menuItems: MenuItem[] = [
    {
      icon: 'globe-outline',
      label: 'Currency Settings',
      sublabel: 'Manage default currency',
      route: '/settings',
    },
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      sublabel: 'Manage push notifications',
    },
    {
      icon: 'shield-checkmark-outline',
      label: 'Privacy & Security',
      sublabel: 'Manage data & privacy',
    },
    {
      icon: 'help-circle-outline',
      label: 'Help & Support',
      sublabel: 'FAQs and contact',
    },
    {
      icon: 'document-text-outline',
      label: 'Terms of Service',
      sublabel: 'Legal information',
    },
  ];

  const handleMenuItemPress = (item: MenuItem): void => {
    if (item.route) {
      router.push(item.route as never);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Profile</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Ionicons name="person-circle" size={60} color={Colors.primary} />
          </View>
          <Text style={styles.profileName}>SplitBill User</Text>
          <Text style={styles.profileEmail}>Device-based account</Text>
        </View>

        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              testID={`menu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              style={styles.menuItem}
              onPress={() => handleMenuItemPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon} size={22} color={Colors.primary} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSublabel}>{item.sublabel}</Text>
              </View>
              {item.route && <Ionicons name="chevron-forward" size={18} color={Colors.muted} />}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          testID="logout-btn"
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={22} color={Colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>SplitBill v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
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
    paddingBottom: 100,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -1,
    paddingTop: 16,
    marginBottom: 24,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 32,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLargeText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primaryForeground,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: `${Colors.primary}15`,
    borderRadius: 100,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  menuSection: {
    gap: 4,
    marginBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  menuSublabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: `${Colors.error}15`,
    borderRadius: 16,
    marginBottom: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
  },
  versionText: {
    fontSize: 12,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },
});
