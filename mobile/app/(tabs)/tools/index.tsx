import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

const TOOLS = [
  { slug: 'summarizer', name: 'Notes Summarizer', description: 'Bullet-point review from your notes.' },
  { slug: 'simplifier', name: 'Concept Simplifier', description: 'Re-explains a concept, progressively simpler.' },
  { slug: 'formula', name: 'Formula Explainer', description: 'Variables, when it applies, a worked example.' },
  { slug: 'lecture', name: 'Lecture Summarizer', description: 'Clean review from a lecture transcript.' },
  { slug: 'flashcards', name: 'Flashcards', description: 'Turn material into study flashcards.' },
  { slug: 'quiz', name: 'Quiz Generator', description: 'Multiple-choice questions from your material.' },
  { slug: 'mindmap', name: 'Mind Map', description: 'Visual tree of a topic’s structure.' },
  { slug: 'pdf-reader', name: 'PDF Reader', description: 'Upload a PDF and get a study-ready breakdown.' },
] as const;

export default function ToolsHubScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={TOOLS}
        keyExtractor={(t) => t.slug}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Text style={styles.label}>Learning Tools</Text>
            <Text style={styles.title}>Pick a tool.</Text>
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(
                item.slug === 'flashcards' || item.slug === 'quiz' || item.slug === 'mindmap' || item.slug === 'pdf-reader'
                  ? `/tools/${item.slug}`
                  : { pathname: '/tools/[tool]', params: { tool: item.slug } },
              )
            }
            style={styles.card}
          >
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
