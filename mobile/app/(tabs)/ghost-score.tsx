import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { KnowledgeGraphRow, TimelineEntryRow, TopicMasteryRow } from '@priorbyte/shared/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { computeGhostScoreSeries, type GhostScorePoint } from '@/lib/ghost-score';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

const CHART_HEIGHT = 120;

function ScoreChart({ series }: { series: GhostScorePoint[] }) {
  if (series.length < 2) {
    return (
      <Text style={styles.muted}>
        Not enough tracked activity yet to plot a trend — keep studying and this fills in.
      </Text>
    );
  }
  // Simple bar-based trend, not a full charting library — same data
  // (computeGhostScoreSeries), just a lighter-weight render than pulling in
  // an SVG/charting dependency for one screen.
  const recent = series.slice(-14);
  return (
    <View style={styles.chart}>
      {recent.map((point) => (
        <View key={point.date} style={styles.chartBarWrap}>
          <View style={[styles.chartBar, { height: Math.max(2, (point.score / 100) * CHART_HEIGHT) }]} />
        </View>
      ))}
    </View>
  );
}

function scoreColor(score: number): string {
  if (score >= 75) return COLORS.teal;
  if (score >= 50) return COLORS.cyan;
  if (score >= 25) return COLORS.silver;
  return COLORS.amber;
}

interface ScoreData {
  current: number;
  series: GhostScorePoint[];
  bySubject: { subject: string; score: number }[];
  preventedCount: number;
  occurredCount: number;
}

export default function GhostScoreScreen() {
  const { profile } = useAuth();
  const [data, setData] = useState<ScoreData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;

    const [{ data: timelineEntries }, { data: resolvedPredictions }, { data: masteryRows }, { data: topics }] =
      await Promise.all([
        supabase
          .from('timeline_entries')
          .select('topic_id, stage, occurred_at')
          .eq('user_id', profile.id)
          .order('occurred_at', { ascending: true }),
        supabase
          .from('predicted_errors')
          .select('outcome, resolved_at')
          .eq('user_id', profile.id)
          .in('outcome', ['prevented', 'occurred'])
          .not('resolved_at', 'is', null),
        supabase.from('topic_mastery').select('*').eq('user_id', profile.id).returns<TopicMasteryRow[]>(),
        supabase
          .from('knowledge_graph')
          .select('id, slug, title, subject, summary, misconceptions, created_at, updated_at')
          .returns<KnowledgeGraphRow[]>(),
      ]);

    const resolved = (resolvedPredictions ?? [])
      .filter((p): p is { outcome: 'prevented' | 'occurred'; resolved_at: string } => p.resolved_at !== null)
      .map((p) => ({ outcome: p.outcome, resolvedAt: p.resolved_at }));

    const { series, current } = computeGhostScoreSeries(timelineEntries ?? [], resolved);

    const topicById = new Map((topics ?? []).map((t) => [t.id, t]));
    const subjectScores = new Map<string, { total: number; count: number }>();
    for (const m of masteryRows ?? []) {
      const topic = topicById.get(m.topic_id);
      if (!topic) continue;
      const stageValue = { believed: 1, learned: 2, practiced: 3, mastered: 4 }[m.stage];
      const existing = subjectScores.get(topic.subject) ?? { total: 0, count: 0 };
      existing.total += (stageValue / 4) * 100;
      existing.count += 1;
      subjectScores.set(topic.subject, existing);
    }
    const bySubject = [...subjectScores.entries()]
      .map(([subject, { total, count }]) => ({ subject, score: Math.round(total / count) }))
      .sort((a, b) => b.score - a.score);

    setData({
      current,
      series,
      bySubject,
      preventedCount: resolved.filter((p) => p.outcome === 'prevented').length,
      occurredCount: resolved.filter((p) => p.outcome === 'occurred').length,
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
        <Text style={styles.label}>Ghost Score</Text>
        <Text style={styles.title}>A single number for how you&apos;re doing.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Current score</Text>
          <Text style={[styles.scoreValue, { color: data ? scoreColor(data.current) : COLORS.muted }]}>
            {data?.current ?? '—'}
          </Text>
          <View style={{ flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md }}>
            <Text style={[styles.tinyLabel, { color: COLORS.teal }]}>{data?.preventedCount ?? 0} prevented</Text>
            <Text style={[styles.tinyLabel, { color: COLORS.amber }]}>{data?.occurredCount ?? 0} occurred</Text>
          </View>
          {data && <ScoreChart series={data.series} />}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>By subject</Text>
        {(data?.bySubject.length ?? 0) === 0 ? (
          <Text style={styles.muted}>Subjects show up here once topics are tracked.</Text>
        ) : (
          data?.bySubject.map(({ subject, score }) => (
            <View key={subject} style={styles.subjectRow}>
              <Text style={styles.subjectName}>{subject}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${score}%` }]} />
              </View>
              <Text style={styles.tinyLabel}>{score}</Text>
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
    fontSize: 20,
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
    padding: SPACING.lg,
  },
  scoreValue: { fontFamily: FONTS.display, fontSize: 56, marginVertical: SPACING.xs },
  tinyLabel: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: CHART_HEIGHT,
  },
  chartBarWrap: { flex: 1, justifyContent: 'flex-end' },
  chartBar: { backgroundColor: COLORS.cyan, borderRadius: 2, width: '100%' },
  sectionTitle: {
    fontFamily: FONTS.label,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.white,
    marginBottom: SPACING.sm,
  },
  muted: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  subjectName: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.silver, width: 100 },
  progressTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: COLORS.line, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.cyan },
});
