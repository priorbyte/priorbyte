import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { apiPost } from '@/lib/api';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

interface Flashcard {
  front: string;
  back: string;
}

export default function FlashcardsScreen() {
  const [content, setContent] = useState('');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const data = await apiPost<{ cards: Flashcard[] }>('/api/mobile/tools/flashcards', {
        content: content.trim(),
      });
      setCards(data.cards);
      setIndex(0);
      setFlipped(false);
    } catch (err) {
      Alert.alert('Could not generate', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }

  const current = cards[index];

  return (
    <>
      <Stack.Screen options={{ title: 'Flashcards' }} />
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

        {current && (
          <View style={{ marginTop: SPACING.lg }}>
            <Text style={styles.tinyLabel}>
              {index + 1} / {cards.length}
            </Text>
            <Pressable onPress={() => setFlipped((f) => !f)} style={styles.flashcard}>
              <Text style={styles.flashcardText}>{flipped ? current.back : current.front}</Text>
              <Text style={styles.tinyLabel}>{flipped ? 'Back — tap to flip' : 'Front — tap to flip'}</Text>
            </Pressable>
            <View style={styles.navRow}>
              <Pressable
                disabled={index === 0}
                onPress={() => {
                  setIndex((i) => i - 1);
                  setFlipped(false);
                }}
                style={[styles.navButton, index === 0 && { opacity: 0.4 }]}
              >
                <Text style={styles.navButtonText}>Prev</Text>
              </Pressable>
              <Pressable
                disabled={index === cards.length - 1}
                onPress={() => {
                  setIndex((i) => i + 1);
                  setFlipped(false);
                }}
                style={[styles.navButton, index === cards.length - 1 && { opacity: 0.4 }]}
              >
                <Text style={styles.navButtonText}>Next</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  tinyLabel: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, textAlign: 'center' },
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
  },
  submitButtonText: { fontFamily: FONTS.display, fontSize: 14, color: COLORS.background },
  flashcard: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: COLORS.cyan,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  flashcardText: { fontFamily: FONTS.sans, fontSize: 16, color: COLORS.white, textAlign: 'center' },
  navRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  navButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
  },
  navButtonText: { fontFamily: FONTS.label, fontSize: 11, textTransform: 'uppercase', color: COLORS.muted },
});
