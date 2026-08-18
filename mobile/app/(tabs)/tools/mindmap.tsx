import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { apiPost } from '@/lib/api';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

interface MindMap {
  topic: string;
  branches: { label: string; children: { label: string }[] }[];
}

export default function MindMapScreen() {
  const [content, setContent] = useState('');
  const [map, setMap] = useState<MindMap | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const data = await apiPost<{ map: MindMap }>('/api/mobile/tools/mindmap', { content: content.trim() });
      setMap(data.map);
    } catch (err) {
      Alert.alert('Could not generate', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Mind Map' }} />
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

        {map && (
          <View style={{ marginTop: SPACING.lg }}>
            <Text style={styles.topic}>{map.topic}</Text>
            {map.branches.map((branch, bi) => (
              <View key={bi} style={styles.branch}>
                <Text style={styles.branchLabel}>{branch.label}</Text>
                {branch.children.map((leaf, li) => (
                  <Text key={li} style={styles.leafLabel}>
                    · {leaf.label}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}
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
  },
  submitButtonText: { fontFamily: FONTS.display, fontSize: 14, color: COLORS.background },
  topic: {
    fontFamily: FONTS.display,
    fontSize: 20,
    textTransform: 'uppercase',
    color: COLORS.cyan,
    marginBottom: SPACING.md,
  },
  branch: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.cyan,
    paddingLeft: SPACING.md,
    marginBottom: SPACING.md,
  },
  branchLabel: { fontFamily: FONTS.sans, fontSize: 15, color: COLORS.white, marginBottom: 4 },
  leafLabel: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.silver, marginLeft: SPACING.sm },
});
