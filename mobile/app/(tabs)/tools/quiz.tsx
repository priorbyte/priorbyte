import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { apiPost } from '@/lib/api';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export default function QuizScreen() {
  const [content, setContent] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const data = await apiPost<{ questions: QuizQuestion[] }>('/api/mobile/tools/quiz', {
        content: content.trim(),
      });
      setQuestions(data.questions);
      setAnswers({});
    } catch (err) {
      Alert.alert('Could not generate', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Quiz Generator' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Paste study material…"
          placeholderTextColor={COLORS.muted}
          multiline
          style={styles.textArea}
        />
        <Pressable onPress={generate} disabled={loading || !content.trim()} style={styles.submitButton}>
          {loading ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <Text style={styles.submitButtonText}>Generate</Text>
          )}
        </Pressable>

        {questions.map((q, qi) => {
          const selected = answers[qi];
          const answered = selected !== undefined;
          return (
            <View key={qi} style={styles.card}>
              <Text style={styles.question}>{q.question}</Text>
              {q.options.map((opt, oi) => {
                const isCorrect = oi === q.correctIndex;
                const isSelected = oi === selected;
                return (
                  <Pressable
                    key={oi}
                    disabled={answered}
                    onPress={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                    style={[
                      styles.option,
                      answered && isCorrect && styles.optionCorrect,
                      answered && isSelected && !isCorrect && styles.optionWrong,
                    ]}
                  >
                    <Text style={styles.optionText}>{opt}</Text>
                  </Pressable>
                );
              })}
              {answered && <Text style={styles.explanation}>{q.explanation}</Text>}
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  textArea: {
    minHeight: 120,
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
    marginBottom: SPACING.lg,
  },
  submitButtonText: { fontFamily: FONTS.display, fontSize: 14, color: COLORS.background },
  card: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  question: { fontFamily: FONTS.sans, fontSize: 15, color: COLORS.white, marginBottom: SPACING.sm },
  option: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  optionCorrect: { borderColor: COLORS.teal, backgroundColor: `${COLORS.teal}22` },
  optionWrong: { borderColor: COLORS.amber, backgroundColor: `${COLORS.amber}22` },
  optionText: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.silver },
  explanation: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: COLORS.muted,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
});
