import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

export default function FinishOnWebScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Finish signup on the web</Text>
          <Text style={styles.body}>
            Your account exists but hasn&apos;t finished onboarding yet — that step (profile,
            academic details, diagnostic questions) happens on priorbyte.app in a browser. Once
            it&apos;s done, come back and sign in here.
          </Text>
          <Pressable onPress={() => void signOut()} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.lg },
  card: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 22,
    textTransform: 'uppercase',
    color: COLORS.cyan,
    marginBottom: SPACING.sm,
  },
  body: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: COLORS.silver,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  signOutButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  signOutText: {
    fontFamily: FONTS.label,
    fontSize: 11,
    textTransform: 'uppercase',
    color: COLORS.muted,
  },
});
