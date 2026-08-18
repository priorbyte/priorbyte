import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { KnowledgeGraphRow, PredictedErrorRow, TopicMasteryRow } from '@priorbyte/shared/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { computeConsistency, computeStreak, getGreeting, toActiveDateSet } from '@/lib/dashboard';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_FIVE_DAYS_MS = 35 * 24 * 60 * 60 * 1000;

interface DashboardData {
  streak: number;
  consistency: number;
  upcoming: { prediction: PredictedErrorRow; topic: KnowledgeGraphRow | undefined }[];
  weakTopics: { mastery: TopicMasteryRow; topic: KnowledgeGraphRow }[];
  strongTopics: { mastery: TopicMasteryRow; topic: KnowledgeGraphRow }[];
}

export default function DashboardScreen() {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;

    const thirtyFiveDaysAgo = new Date(Date.now() - THIRTY_FIVE_DAYS_MS).toISOString();

    const [{ data: recentDates }, { data: masteryRows }, { data: allTopics }, { data: predictions }] =
      await Promise.all([
        supabase
          .from('learning_events')
          .select('occurred_at')
          .eq('user_id', profile.id)
          .gte('occurred_at', thirtyFiveDaysAgo),
        supabase.from('topic_mastery').select('*').eq('user_id', profile.id).returns<TopicMasteryRow[]>(),
        supabase
          .from('knowledge_graph')
          .select('id, slug, title, subject, summary, misconceptions, created_at, updated_at')
          .returns<KnowledgeGraphRow[]>(),
        supabase
          .from('predicted_errors')
          .select('*')
          .eq('user_id', profile.id)
          .eq('outcome', 'pending')
          .order('confidence', { ascending: false })
          .limit(3)
          .returns<PredictedErrorRow[]>(),
      ]);

    const activeDates = toActiveDateSet((recentDates ?? []).map((r) => r.occurred_at));
    const topicById = new Map((allTopics ?? []).map((t) => [t.id, t]));

    const weakTopics = (masteryRows ?? [])
      .filter((m) => m.stage === 'believed')
      .map((mastery) => {
        const topic = topicById.get(mastery.topic_id);
        return topic ? { mastery, topic } : null;
      })
      .filter((x): x is { mastery: TopicMasteryRow; topic: KnowledgeGraphRow } => x !== null)
      .sort((a, b) => a.mastery.confidence - b.mastery.confidence)
      .slice(0, 5);

    const strongTopics = (masteryRows ?? [])
      .filter((m) => m.stage === 'mastered')
      .map((mastery) => {
        const topic = topicById.get(mastery.topic_id);
        return topic ? { mastery, topic } : null;
      })
      .filter((x): x is { mastery: TopicMasteryRow; topic: KnowledgeGraphRow } => x !== null)
      .slice(0, 5);

    setData({
      streak: computeStreak(activeDates),
      consistency: computeConsistency(activeDates, new Date(profile.created_at)),
      upcoming: (predictions ?? []).map((p) => ({ prediction: p, topic: topicById.get(p.topic_id) })),
      weakTopics,
      strongTopics,
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

  const firstName =
    profile?.nickname ?? profile?.display_name?.split(' ')[0] ?? profile?.email.split('@')[0] ?? '';
  const greeting = getGreeting(profile?.time_zone ?? 'UTC');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cyan} />}
      >
        <Text style={styles.label}>Dashboard</Text>
        <Text style={styles.greeting}>
          {greeting}, {firstName}.
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.label}>Streak</Text>
            <Text style={styles.statValue}>{data?.streak ?? '—'}d</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.label}>Consistency</Text>
            <Text style={styles.statValue}>{data?.consistency ?? '—'}%</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>Upcoming inoculations</Text>
        {!data ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : data.upcoming.length === 0 ? (
          <Text style={styles.muted}>
            No predictions waiting yet — visit Ghost Oracle to generate some from your captured
            work.
          </Text>
        ) : (
          data.upcoming.map(({ prediction, topic }) => (
            <View key={prediction.id} style={styles.card}>
              <Text style={styles.label}>{topic?.title ?? 'Topic'}</Text>
              <Text style={styles.cardBody}>{prediction.prediction}</Text>
              <Text style={styles.muted}>{Math.round(prediction.confidence * 100)}% confidence</Text>
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>Needs attention</Text>
        {(data?.weakTopics.length ?? 0) === 0 ? (
          <Text style={styles.muted}>Nothing flagged yet.</Text>
        ) : (
          data?.weakTopics.map(({ topic }) => (
            <View key={topic.id} style={styles.row}>
              <Text style={styles.rowText}>{topic.title}</Text>
              <Text style={styles.rowTag}>{topic.subject}</Text>
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>Mastered</Text>
        {(data?.strongTopics.length ?? 0) === 0 ? (
          <Text style={styles.muted}>No topics mastered yet.</Text>
        ) : (
          data?.strongTopics.map(({ topic }) => (
            <View key={topic.id} style={styles.row}>
              <Text style={styles.rowText}>{topic.title}</Text>
              <Text style={[styles.rowTag, { color: COLORS.teal }]}>{topic.subject}</Text>
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
  greeting: {
    fontFamily: FONTS.display,
    fontSize: 26,
    textTransform: 'uppercase',
    color: COLORS.white,
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  statsRow: { flexDirection: 'row', gap: SPACING.md },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
  },
  statValue: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.cyan,
    marginTop: 4,
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
  card: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardBody: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: COLORS.silver,
    marginTop: 4,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  rowText: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.silver },
  rowTag: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.amber },
});
