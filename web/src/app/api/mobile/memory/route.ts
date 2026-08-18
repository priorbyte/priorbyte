import { NextResponse, type NextRequest } from 'next/server';
import type { LearningEventRow, MatchedLearningEvent } from '@priorbyte/shared/database';
import { getMobileUser } from '@/lib/mobile-auth';
import { backfillPendingEmbeddings } from '@/lib/embeddings';
import { embedQuery, isVoyageConfigured, toPgVectorLiteral } from '@/lib/voyage';

/** Mobile equivalent of web/src/app/(app)/memory/page.tsx's search logic. */

export const dynamic = 'force-dynamic';

const MAX_QUERY_LENGTH = 200;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await getMobileUser(request);
  if (!supabase || !user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const query = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH);
  const semanticAvailable = isVoyageConfigured();

  if (semanticAvailable) {
    await backfillPendingEmbeddings(supabase, user.id);
  }

  if (!query) {
    return NextResponse.json({ results: [], semanticAvailable, usedSemanticSearch: false });
  }

  let results: { id: string; type: string; content: string; occurred_at: string; similarity: number | null }[] = [];
  let usedSemanticSearch = false;

  if (semanticAvailable) {
    const embedding = await embedQuery(query);
    if (embedding) {
      const { data } = await supabase.rpc('match_learning_events', {
        query_embedding: toPgVectorLiteral(embedding),
        match_threshold: 0.65,
        match_count: 20,
      });
      if (data) {
        usedSemanticSearch = true;
        results = (data as MatchedLearningEvent[]).map((r) => ({
          id: r.id,
          type: r.type,
          content: r.content,
          occurred_at: r.occurred_at,
          similarity: r.similarity,
        }));
      }
    }
  }

  if (!usedSemanticSearch) {
    const { data } = await supabase
      .from('learning_events')
      .select('id, type, content, occurred_at')
      .eq('user_id', user.id)
      .ilike('content', `%${escapeLike(query)}%`)
      .order('occurred_at', { ascending: false })
      .limit(20)
      .returns<Pick<LearningEventRow, 'id' | 'type' | 'content' | 'occurred_at'>[]>();
    results = (data ?? []).map((r) => ({ ...r, similarity: null }));
  }

  return NextResponse.json({ results, semanticAvailable, usedSemanticSearch });
}

/** Manual capture, same as web's captureTestNote server action. */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getMobileUser(request);
  if (!supabase || !user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content) return NextResponse.json({ error: 'Write something first.' }, { status: 400 });
  if (content.length > 20_000) return NextResponse.json({ error: 'Too long.' }, { status: 400 });

  const { error } = await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'note',
    content,
    source: 'manual_mobile',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
