import type { Metadata } from 'next';
import type { LearningEventRow, MatchedLearningEvent } from '@priorbyte/shared/database';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { backfillPendingEmbeddings } from '@/lib/embeddings';
import { embedQuery, isVoyageConfigured, toPgVectorLiteral } from '@/lib/voyage';
import { CaptureForm } from './capture-form';

export const metadata: Metadata = { title: 'Ghost Memory' };

const MAX_QUERY_LENGTH = 200;

/** Escapes ILIKE wildcards so a search for "50%" or "a_b" doesn't pattern-match. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

interface ResultRow {
  id: string;
  type: string;
  content: string;
  occurred_at: string;
  similarity: number | null;
}

export default async function MemoryPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();

  const query = (searchParams.q ?? '').trim().slice(0, MAX_QUERY_LENGTH);
  const semanticAvailable = isVoyageConfigured();

  // Stand-in for the Section 9 Edge Function: embed anything captured since
  // the last visit before searching, so a fresh capture is findable right away.
  if (semanticAvailable) {
    await backfillPendingEmbeddings(supabase, profile.id);
  }

  let results: ResultRow[] = [];
  let usedSemanticSearch = false;
  let searchError: string | null = null;

  if (query) {
    if (semanticAvailable) {
      const embedding = await embedQuery(query);
      if (embedding) {
        const { data, error } = await supabase.rpc('match_learning_events', {
          query_embedding: toPgVectorLiteral(embedding),
          match_threshold: 0.65,
          match_count: 20,
        });
        if (error) {
          searchError = error.message;
        } else {
          usedSemanticSearch = true;
          results = (data ?? []).map((r: MatchedLearningEvent) => ({
            id: r.id,
            type: r.type,
            content: r.content,
            occurred_at: r.occurred_at,
            similarity: r.similarity,
          }));
        }
      }
    }

    // Keyword fallback: no Voyage key configured, or the embedding call failed.
    if (!usedSemanticSearch && !searchError) {
      const { data, error } = await supabase
        .from('learning_events')
        .select('id, type, content, occurred_at')
        .eq('user_id', profile.id)
        .ilike('content', `%${escapeLike(query)}%`)
        .order('occurred_at', { ascending: false })
        .limit(20)
        .returns<Pick<LearningEventRow, 'id' | 'type' | 'content' | 'occurred_at'>[]>();

      if (error) {
        searchError = error.message;
      } else {
        results = (data ?? []).map((r) => ({ ...r, similarity: null }));
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="pb-label">Ghost Memory</p>
        <h1 className="mt-2 text-4xl">Search your own past mistakes</h1>
        <p className="mt-2 max-w-2xl text-silver">
          {semanticAvailable
            ? 'Searches by meaning, not exact wording — a search for "chain rule" finds events that never used those words.'
            : 'Keyword search for now. Semantic search (finding events by meaning, not exact wording) turns on automatically once an embedding provider is configured.'}
        </p>
      </div>

      <CaptureForm />

      <form method="get" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="e.g. forgot the negative sign"
          className="flex-1 rounded-lg border border-line bg-background px-4 py-3 text-white outline-none transition placeholder:text-muted focus:border-cyan/60"
        />
        <button
          type="submit"
          className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow"
        >
          Search
        </button>
      </form>

      {!query && (
        <p className="text-sm text-muted">Search above to see matching captured events.</p>
      )}

      {query && searchError && (
        <p className="text-sm text-amber" role="alert">
          {searchError}
        </p>
      )}

      {query && !searchError && results.length === 0 && (
        <p className="text-sm text-muted">
          No matches for &ldquo;{query}&rdquo;. Nothing captured yet contains that
          {semanticAvailable ? ' meaning' : ' text'}.
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-3">
          {results.map((r) => (
            <li key={r.id} className="pb-panel">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-cyan">
                  {r.type}
                </span>
                <div className="flex items-center gap-3">
                  {r.similarity !== null && (
                    <span className="font-mono text-xs text-teal">
                      {Math.round(r.similarity * 100)}% match
                    </span>
                  )}
                  <span className="font-mono text-xs text-muted">
                    {new Date(r.occurred_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-silver">{r.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
