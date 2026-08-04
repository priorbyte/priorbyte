import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@priorbyte/shared/database';
import { embedDocuments, isVoyageConfigured, toPgVectorLiteral } from './voyage';

const BACKFILL_BATCH_SIZE = 25;

/**
 * Stand-in for the Section 9 "Embed" Edge Function, which needs
 * `supabase login` (a separate CLI auth from the Supabase MCP connection)
 * to deploy — not available yet. This runs inline instead: on every Ghost
 * Memory visit, embed up to 25 of the caller's own not-yet-embedded events.
 *
 * Uses the caller's own session-scoped client, not the service role — the
 * existing "owner updates own" RLS policy on learning_events already allows
 * a user to set their own embedding column, so no elevated access is needed.
 */
export async function backfillPendingEmbeddings(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ embedded: number }> {
  if (!isVoyageConfigured()) return { embedded: 0 };

  const { data: pending } = await supabase
    .from('learning_events')
    .select('id, content')
    .eq('user_id', userId)
    .is('embedding', null)
    .order('created_at', { ascending: true })
    .limit(BACKFILL_BATCH_SIZE);

  if (!pending || pending.length === 0) return { embedded: 0 };

  const embeddings = await embedDocuments(pending.map((p) => p.content));

  let embedded = 0;
  await Promise.all(
    pending.map(async (row, i) => {
      const vector = embeddings[i];
      if (!vector) return;
      const { error } = await supabase
        .from('learning_events')
        .update({ embedding: toPgVectorLiteral(vector) })
        .eq('id', row.id);
      if (!error) embedded += 1;
    }),
  );

  return { embedded };
}
