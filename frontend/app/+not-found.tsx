import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../utils/colors';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="compass-outline" size={64} color={Colors.primary} />
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.description}>
          The page you are trying to open does not exist or has been moved.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(tabs)/home')}>
          <Text style={styles.primaryButtonText}>Go to Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  primaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    minWidth: 180,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.primaryForeground,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 180,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
