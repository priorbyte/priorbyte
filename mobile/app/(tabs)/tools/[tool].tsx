import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { apiPost } from '@/lib/api';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

const TOOL_CONFIG: Record<
  string,
  { title: string; placeholder: string; apiPath: string; resultKey: string; maxLength: number }
> = {
  summarizer: {
    title: 'Notes Summarizer',
    placeholder: 'Paste your notes…',
    apiPath: '/api/mobile/tools/summarizer',
    resultKey: 'summary',
    maxLength: 20_000,
  },
  simplifier: {
    title: 'Concept Simplifier',
    placeholder: 'Paste a concept or term…',
    apiPath: '/api/mobile/tools/simplifier',
    resultKey: 'simplified',
    maxLength: 5000,
  },
  formula: {
    title: 'Formula Explainer',
    placeholder: 'Paste a formula or equation…',
    apiPath: '/api/mobile/tools/formula',
    resultKey: 'explanation',
    maxLength: 2000,
  },
  lecture: {
    title: 'Lecture Summarizer',
    placeholder: 'Paste a lecture transcript…',
    apiPath: '/api/mobile/tools/lecture',
    resultKey: 'summary',
    maxLength: 60_000,
  },
};

export default function GenericToolScreen() {
  const { tool } = useLocalSearchParams<{ tool: string }>();
  const config = TOOL_CONFIG[tool ?? ''];

  const [content, setContent] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!config) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Unknown tool.</Text>
      </View>
    );
  }

  async function generate() {
    if (!content.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await apiPost<Record<string, string>>(config.apiPath, { content: content.trim() });
      setResult(data[config.resultKey]);
    } catch (err) {
      Alert.alert('Could not generate', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: config.title }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder={config.placeholder}
          placeholderTextColor={COLORS.muted}
          multiline
          maxLength={config.maxLength}
          style={styles.textArea}
        />
        <Pressable onPress={generate} disabled={loading || !content.trim()} style={styles.submitButton}>
          {loading ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <Text style={styles.submitButtonText}>Generate</Text>
          )}
        </Pressable>

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  muted: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted },
  textArea: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    color: COLORS.white,
    fontFamily: FONTS.sans,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: COLORS.cyan,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.md,
  },
  submitButtonText: { fontFamily: FONTS.display, fontSize: 14, color: COLORS.background },
  resultCard: {
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
  },
  resultText: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.silver, lineHeight: 20 },
});
