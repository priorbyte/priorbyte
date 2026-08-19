import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TIMELINE_STAGES, type TimelineStage } from '@priorbyte/shared/constants';
import type { KnowledgeGraphRow, TimelineEntryRow, TopicMasteryRow } from '@priorbyte/shared/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

const STAGE_LABELS: Record<TimelineStage, string> = {
  believed: 'Believed',
  learned: 'Learned',
  practiced: 'Practiced',
  mastered: 'Mastered',
};

function StageTracker({ stage }: { stage: TimelineStage | null }) {
  const currentIndex = stage ? TIMELINE_STAGES.indexOf(stage) : -1;
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: SPACING.sm }}>
      {TIMELINE_STAGES.map((s, i) => {
        const reached = i <= currentIndex;
        return (
          <View key={s} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View
              style={{
                height: 6,
                width: '100%',
                borderRadius: 999,
                backgroundColor: reached ? COLORS.cyan : COLORS.line,
              }}
            />
            <Text style={[styles.tinyLabel, reached && { color: COLORS.cyan }]}>{STAGE_LABELS[s]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface TimelineData {
  inProgress: { topic: KnowledgeGraphRow; mastery: TopicMasteryRow | null }[];
  entries: (TimelineEntryRow & { topicTitle?: string })[];
}

export default function TimelineScreen() {
  const { profile } = useAuth();
  const [data, setData] = useState<TimelineData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: masteryRows }, { data: allTopics }, { data: recentEntries }] = await Promise.all([
      supabase.from('topic_mastery').select('*').eq('user_id', profile.id).returns<TopicMasteryRow[]>(),
      supabase
        .from('knowledge_graph')
        .select('id, slug, title, subject, summary, misconceptions, created_at, updated_at')
        .returns<KnowledgeGraphRow[]>(),
      supabase
        .from('timeline_entries')
        .select('*')
        .eq('user_id', profile.id)
        .order('occurred_at', { ascending: false })
        .limit(20)
        .returns<TimelineEntryRow[]>(),
    ]);

    const topicById = new Map((allTopics ?? []).map((t) => [t.id, t]));
    const masteryByTopic = new Map((masteryRows ?? []).map((m) => [m.topic_id, m]));
    const startedIds = new Set(masteryByTopic.keys());
    const inProgress = (allTopics ?? [])
      .filter((t) => startedIds.has(t.id))
      .map((topic) => ({ topic, mastery: masteryByTopic.get(topic.id) ?? null }));

    setData({
      inProgress,
      entries: (recentEntries ?? []).map((e) => ({ ...e, topicTitle: topicById.get(e.topic_id)?.title })),
    });
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cyan} />}
      >
        <Text style={styles.label}>Ghost Timeline</Text>
        <Text style={styles.title}>Believed → Learned → Practiced → Mastered</Text>

        <Text style={styles.sectionTitle}>In progress</Text>
        {!data ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : data.inProgress.length === 0 ? (
          <Text style={styles.muted}>No topic underway yet.</Text>
        ) : (
          data.inProgress.map(({ topic, mastery }) => (
            <View key={topic.id} style={styles.card}>
              <Text style={styles.label}>{topic.subject}</Text>
              <Text style={styles.cardTitle}>{topic.title}</Text>
              <StageTracker stage={mastery?.stage ?? null} />
              {mastery && (
                <Text style={[styles.muted, { marginTop: SPACING.sm }]}>
                  {Math.round(mastery.confidence * 100)}% confidence
                </Text>
              )}
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>Recent activity</Text>
        {(data?.entries.length ?? 0) === 0 ? (
          <Text style={styles.muted}>Stage transitions will appear here as they happen.</Text>
        ) : (
          data?.entries.map((entry) => (
            <View key={entry.id} style={styles.card}>
              <Text style={styles.cardBody}>
                <Text style={{ color: COLORS.cyan }}>{STAGE_LABELS[entry.stage]}</Text>
                {entry.topicTitle ? ` — ${entry.topicTitle}` : ''}
              </Text>
              <Text style={styles.muted}>{entry.summary}</Text>
              <Text style={[styles.tinyLabel, { marginTop: 4 }]}>{formatWhen(entry.occurred_at)}</Text>
            </View>
          ))
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
    fontSize: 22,
    textTransform: 'uppercase',
    color: COLORS.white,
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontFamily: FONTS.label,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.white,
    marginBottom: SPACING.sm,
  },
  muted: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted },
  tinyLabel: { fontFamily: FONTS.sans, fontSize: 9, textTransform: 'uppercase', color: COLORS.muted },
  card: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTitle: { fontFamily: FONTS.sans, fontSize: 16, color: COLORS.white, marginTop: 2 },
  cardBody: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.silver },
});
