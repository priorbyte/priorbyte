import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

export default function SettingsScreen() {
  const { profile, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.label}>Settings</Text>
        <Text style={styles.title}>{profile?.display_name ?? profile?.username ?? 'Account'}</Text>

        <View style={styles.card}>
          <Row label="Email" value={profile?.email ?? '—'} />
          <Row label="Role" value={profile?.role ?? '—'} />
          <Row label="Tier" value={profile?.subscription_tier ?? '—'} />
          <Row label="University" value={profile?.university_name ?? '—'} />
        </View>

        <Text style={styles.muted}>
          Theme, accent color, and dashboard preferences are managed on the Priorbyte website for
          now.
        </Text>

        <Pressable onPress={() => void signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg },
  label: {
    fontFamily: FONTS.label,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.muted,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 22,
    textTransform: 'uppercase',
    color: COLORS.white,
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  rowLabel: { fontFamily: FONTS.label, fontSize: 11, textTransform: 'uppercase', color: COLORS.muted },
  rowValue: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.silver },
  muted: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginBottom: SPACING.lg },
  signOutButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.amber,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
  },
  signOutText: { fontFamily: FONTS.label, fontSize: 12, textTransform: 'uppercase', color: COLORS.amber },
});
