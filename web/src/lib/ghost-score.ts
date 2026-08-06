import type { TimelineEntryRow } from '@priorbyte/shared/database';
import type { PredictionOutcome, TimelineStage } from '@priorbyte/shared/constants';

/**
 * Ghost Score turns the raw event log (stage changes + resolved predictions)
 * into a single 0-100 number and a real time series — no snapshot, no mock
 * data. It's a running reconstruction of "how would this have scored at each
 * point in time," derived only from events that actually happened.
 */

const STAGE_VALUE: Record<TimelineStage, number> = {
  believed: 1,
  learned: 2,
  practiced: 3,
  mastered: 4,
};

const MAX_STAGE_VALUE = 4;

/** Points added/subtracted per resolved prediction, layered on top of the mastery base. */
const OUTCOME_ADJUSTMENT: Partial<Record<PredictionOutcome, number>> = {
  prevented: 2,
  occurred: -3,
};

export interface GhostScorePoint {
  /** ISO date (day granularity) this point represents. */
  date: string;
  score: number;
}

interface ResolvedPrediction {
  outcome: PredictionOutcome;
  resolvedAt: string;
}

function averageMastery(stageByTopic: Map<string, number>): number {
  if (stageByTopic.size === 0) return 0;
  let total = 0;
  for (const value of stageByTopic.values()) total += value;
  return (total / stageByTopic.size / MAX_STAGE_VALUE) * 100;
}

/**
 * Merges timeline stage-change events and resolved-prediction events into one
 * chronological stream and walks it, recomputing the score after each event.
 * Same-day events are collapsed to one point (the last state that day) so the
 * chart doesn't show multiple points for a single calendar day.
 */
export function computeGhostScoreSeries(
  timelineEntries: Pick<TimelineEntryRow, 'topic_id' | 'stage' | 'occurred_at'>[],
  resolvedPredictions: ResolvedPrediction[],
): { series: GhostScorePoint[]; current: number } {
  type Event =
    | { at: string; kind: 'stage'; topicId: string; stage: TimelineStage }
    | { at: string; kind: 'prediction'; outcome: PredictionOutcome };

  const events: Event[] = [
    ...timelineEntries.map(
      (e): Event => ({ at: e.occurred_at, kind: 'stage', topicId: e.topic_id, stage: e.stage }),
    ),
    ...resolvedPredictions.map(
      (p): Event => ({ at: p.resolvedAt, kind: 'prediction', outcome: p.outcome }),
    ),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const stageByTopic = new Map<string, number>();
  let oracleAdjustment = 0;
  const pointByDate = new Map<string, number>();

  for (const event of events) {
    if (event.kind === 'stage') {
      stageByTopic.set(event.topicId, STAGE_VALUE[event.stage]);
    } else {
      oracleAdjustment += OUTCOME_ADJUSTMENT[event.outcome] ?? 0;
    }

    const score = Math.max(0, Math.min(100, averageMastery(stageByTopic) + oracleAdjustment));
    const day = event.at.slice(0, 10);
    pointByDate.set(day, Math.round(score));
  }

  const series = [...pointByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, score]) => ({ date, score }));

  return { series, current: series.at(-1)?.score ?? 0 };
}
