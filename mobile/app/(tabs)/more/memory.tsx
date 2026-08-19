import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet } from '@/lib/api';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

interface MemoryResult {
  id: string;
  type: string;
  content: string;
  occurred_at: string;
  similarity: number | null;
}

interface MemoryResponse {
  results: MemoryResult[];
  semanticAvailable: boolean;
}

export default function MemoryScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemoryResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await apiGet<MemoryResponse>(`/api/mobile/memory?q=${encodeURIComponent(query.trim())}`);
      setResults(data.results);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.label}>Ghost Memory</Text>
        <Text style={styles.title}>Search your own past mistakes</Text>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            placeholder="Search by meaning, not exact wording…"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
          />
          <Pressable onPress={search} disabled={searching} style={styles.searchButton}>
            {searching ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <Text style={styles.searchButtonText}>Go</Text>
            )}
          </Pressable>
        </View>

        <FlatList
          data={results}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingTop: SPACING.md, paddingBottom: SPACING.xl }}
          ListEmptyComponent={
            searched ? <Text style={styles.muted}>No matches found.</Text> : null
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.tag}>{item.type}</Text>
                {item.similarity !== null && (
                  <Text style={styles.tinyLabel}>{Math.round(item.similarity * 100)}% match</Text>
                )}
              </View>
              <Text style={styles.cardBody}>{item.content}</Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, padding: SPACING.lg },
  label: {
    fontFamily: FONTS.label,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.muted,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 20,
    textTransform: 'uppercase',
    color: COLORS.white,
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  searchRow: { flexDirection: 'row', gap: SPACING.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.white,
    fontFamily: FONTS.sans,
    fontSize: 14,
  },
  searchButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.cyan,
    borderRadius: 8,
    paddingHorizontal: SPACING.lg,
  },
  searchButtonText: { fontFamily: FONTS.display, fontSize: 13, color: COLORS.background },
  muted: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted },
  tinyLabel: { fontFamily: FONTS.sans, fontSize: 10, color: COLORS.muted },
  tag: {
    fontFamily: FONTS.label,
    fontSize: 10,
    textTransform: 'uppercase',
    color: COLORS.cyan,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardBody: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.silver, marginTop: 6 },
});
