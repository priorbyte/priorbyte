import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { KnowledgeGraphRow, PredictedErrorRow } from '@priorbyte/shared/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { apiPost } from '@/lib/api';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

export default function OracleScreen() {
  const { profile } = useAuth();
  const [predictions, setPredictions] = useState<PredictedErrorRow[]>([]);
  const [topicById, setTopicById] = useState<Map<string, KnowledgeGraphRow>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: preds }, { data: topics }] = await Promise.all([
      supabase
        .from('predicted_errors')
        .select('*')
        .eq('user_id', profile.id)
        .order('predicted_at', { ascending: false })
        .returns<PredictedErrorRow[]>(),
      supabase
        .from('knowledge_graph')
        .select('id, slug, title, subject, summary, misconceptions, created_at, updated_at')
        .returns<KnowledgeGraphRow[]>(),
    ]);
    setPredictions(preds ?? []);
    setTopicById(new Map((topics ?? []).map((t) => [t.id, t])));
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function acknowledge(id: string) {
    await supabase
      .from('predicted_errors')
      .update({ inoculation_acknowledged_at: new Date().toISOString() })
      .eq('id', id)
      .is('inoculation_acknowledged_at', null);
    void load();
  }

  async function resolve(id: string, outcome: 'prevented' | 'occurred') {
    setResolving(id);
    try {
      await apiPost('/api/mobile/oracle', { predictionId: id, outcome });
      await load();
    } catch (err) {
      Alert.alert('Could not resolve', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setResolving(null);
    }
  }

  const pending = predictions.filter((p) => p.outcome === 'pending');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cyan} />}
      >
        <Text style={styles.label}>Ghost Oracle</Text>
        <Text style={styles.title}>Predicted before it happens</Text>

        {pending.length === 0 ? (
          <Text style={styles.muted}>
            No predictions waiting — they refresh automatically each day, or open the web app to
            generate some now.
          </Text>
        ) : (
          pending.map((p) => {
            const topic = topicById.get(p.topic_id);
            return (
              <View key={p.id} style={styles.card}>
                <Text style={styles.label}>{topic?.title ?? 'Topic'}</Text>
                <Text style={styles.cardBody}>{p.prediction}</Text>
                <Text style={styles.tinyLabel}>{Math.round(p.confidence * 100)}% confidence</Text>

                {p.inoculation_content && (
                  <View style={styles.inoculationBox}>
                    <Text style={[styles.tinyLabel, { color: COLORS.cyan, marginBottom: 4 }]}>
                      {p.inoculation_format?.toUpperCase()}
                    </Text>
                    <Text style={styles.cardBody}>{p.inoculation_content}</Text>
                    {!p.inoculation_acknowledged_at && (
                      <Pressable onPress={() => void acknowledge(p.id)} style={styles.ackButton}>
                        <Text style={styles.ackButtonText}>Got it</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                <View style={styles.resolveRow}>
                  <Pressable
                    onPress={() => void resolve(p.id, 'prevented')}
                    disabled={resolving === p.id}
                    style={[styles.resolveButton, { borderColor: COLORS.teal }]}
                  >
                    <Text style={[styles.resolveButtonText, { color: COLORS.teal }]}>Avoided it</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void resolve(p.id, 'occurred')}
                    disabled={resolving === p.id}
                    style={[styles.resolveButton, { borderColor: COLORS.amber }]}
                  >
                    <Text style={[styles.resolveButtonText, { color: COLORS.amber }]}>Made the mistake</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
    fontSize: 20,
    textTransform: 'uppercase',
    color: COLORS.white,
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  muted: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted },
  tinyLabel: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted },
  card: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardBody: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.silver, marginVertical: 4 },
  inoculationBox: {
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingTop: SPACING.sm,
  },
  ackButton: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  ackButtonText: { fontFamily: FONTS.label, fontSize: 10, textTransform: 'uppercase', color: COLORS.muted },
  resolveRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  resolveButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
  },
  resolveButtonText: { fontFamily: FONTS.label, fontSize: 10, textTransform: 'uppercase' },
});
