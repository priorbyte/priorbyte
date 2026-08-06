'use client';

import { useState, useTransition } from 'react';
import type { KnowledgeGraphRow } from '@priorbyte/shared/database';
import { addPrerequisite, deleteTopic, removePrerequisite } from './actions';

export function TopicRow({
  topic,
  allTopics,
  prerequisiteIds,
}: {
  topic: KnowledgeGraphRow;
  allTopics: KnowledgeGraphRow[];
  prerequisiteIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [selectedPrereq, setSelectedPrereq] = useState('');
  const [error, setError] = useState<string | null>(null);

  const prerequisites = prerequisiteIds
    .map((id) => allTopics.find((t) => t.id === id))
    .filter((t): t is KnowledgeGraphRow => Boolean(t));

  const candidates = allTopics.filter(
    (t) => t.id !== topic.id && !prerequisiteIds.includes(t.id),
  );

  return (
    <div className="pb-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="pb-label">{topic.subject}</p>
          <h3 className="mt-1 text-xl text-white">{topic.title}</h3>
          {topic.summary && <p className="mt-1 text-sm text-muted">{topic.summary}</p>}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteTopic(topic.id);
              if (!result.ok) setError(result.message ?? 'Failed to delete.');
            })
          }
          className="shrink-0 rounded-lg border border-amber/40 px-3 py-1.5 text-xs text-amber transition hover:bg-amber/10"
        >
          Delete
        </button>
      </div>

      {topic.misconceptions.length > 0 && (
        <ul className="mt-3 space-y-1">
          {topic.misconceptions.map((m, i) => (
            <li key={i} className="text-sm text-silver">
              · {m}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <p className="pb-label mb-2">Prerequisites</p>
        <div className="flex flex-wrap gap-2">
          {prerequisites.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await removePrerequisite(topic.id, p.id);
                  if (!result.ok) setError(result.message ?? 'Failed to remove.');
                })
              }
              className="rounded-full border border-cyan bg-cyan/10 px-3 py-1.5 text-sm text-cyan"
            >
              {p.title} ×
            </button>
          ))}
        </div>
        {candidates.length > 0 && (
          <div className="mt-2 flex gap-2">
            <select
              value={selectedPrereq}
              onChange={(e) => setSelectedPrereq(e.target.value)}
              className="rounded-lg border border-line bg-background px-2 py-1.5 text-sm text-white outline-none focus:border-cyan/60"
            >
              <option value="">Add prerequisite…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedPrereq || pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await addPrerequisite(topic.id, selectedPrereq);
                  if (result.ok) setSelectedPrereq('');
                  else setError(result.message ?? 'Failed to add.');
                })
              }
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-silver transition hover:border-cyan/40 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-amber" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
