'use client';

import { useState, useTransition } from 'react';
import type { PredictedErrorRow, KnowledgeGraphRow } from '@priorbyte/shared/database';
import { acknowledgeInoculation, resolvePrediction } from './actions';

const FORMAT_LABELS: Record<string, string> = {
  story: 'Story',
  puzzle: 'Puzzle',
  analogy: 'Analogy',
  counterexample: 'Counterexample',
};

function PredictionCard({
  prediction,
  topic,
}: {
  prediction: PredictedErrorRow;
  topic: KnowledgeGraphRow | undefined;
}) {
  const [pending, startTransition] = useTransition();
  const [acknowledged, setAcknowledged] = useState(Boolean(prediction.inoculation_acknowledged_at));

  return (
    <div className="pb-panel space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="pb-label">{topic?.title ?? 'Unknown topic'}</p>
          <p className="mt-1 text-white">{prediction.prediction}</p>
        </div>
        <span className="shrink-0 font-mono text-xs text-muted">
          {Math.round(prediction.confidence * 100)}% confidence
        </span>
      </div>

      {prediction.inoculation_content && (
        <div className="rounded-lg border border-cyan/30 bg-cyan/5 p-4">
          <p className="pb-label text-cyan">
            {FORMAT_LABELS[prediction.inoculation_format ?? ''] ?? 'Inoculation'}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-silver">
            {prediction.inoculation_content}
          </p>
          {!acknowledged && (
            <button
              type="button"
              onClick={() => {
                setAcknowledged(true);
                startTransition(() => void acknowledgeInoculation(prediction.id));
              }}
              className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-cyan hover:underline"
            >
              Got it
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-line pt-4">
        <p className="text-sm text-muted">Did this hold up when you reached the topic?</p>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void resolvePrediction(prediction.id, 'prevented'))}
          className="rounded-lg border border-teal/40 px-4 py-2 text-sm text-teal transition hover:bg-teal/10 disabled:opacity-50"
        >
          Avoided it
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void resolvePrediction(prediction.id, 'occurred'))}
          className="rounded-lg border border-amber/40 px-4 py-2 text-sm text-amber transition hover:bg-amber/10 disabled:opacity-50"
        >
          Made the mistake anyway
        </button>
      </div>
    </div>
  );
}

export function PredictionsList({
  predictions,
  topicById,
}: {
  predictions: PredictedErrorRow[];
  topicById: Map<string, KnowledgeGraphRow>;
}) {
  if (predictions.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing predicted yet — the Oracle needs a topic to reason about and, ideally, some
        captured mistakes to ground the prediction in. Study a bit and check back.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {predictions.map((p) => (
        <PredictionCard key={p.id} prediction={p} topic={topicById.get(p.topic_id)} />
      ))}
    </div>
  );
}
