import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

const GHOST_LINKS = [
  { slug: 'score', name: 'Ghost Score', description: 'How your mastery is trending over time.' },
  { slug: 'timeline', name: 'Timeline', description: 'Believed, learned, practiced, mastered.' },
  { slug: 'oracle', name: 'Oracle', description: 'Predicted errors before you make them.' },
] as const;

export default function GhostHubScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={GHOST_LINKS}
        keyExtractor={(g) => g.slug}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Text style={styles.label}>Ghost</Text>
            <Text style={styles.title}>Your learning signal.</Text>
          </>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/ghost/${item.slug}`)} style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardDescription}>{item.description}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
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
    marginBottom: SPACING.sm,
  },
  cardTitle: { fontFamily: FONTS.sans, fontSize: 15, color: COLORS.white },
  cardDescription: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 4 },
});
