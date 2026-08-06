import { NextResponse, type NextRequest } from 'next/server';
import type { KnowledgeGraphRow, ProfileRow } from '@priorbyte/shared/database';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isGeminiConfigured } from '@/lib/gemini';
import { ensureVulnerabilityModel } from '@/lib/psychic-lattice';
import { generatePredictedErrors } from '@/lib/error-oracle';

/**
 * The real Section 9 cron, replacing the on-page-visit stand-in that used to
 * be the only way Psychic Lattice / Error Oracle ran. Vercel Cron hits this
 * route on a schedule (see vercel.json); ensureVulnerabilityModel's own
 * 24h staleness check means re-running this daily for a user who was just
 * computed is a cheap no-op, not a duplicate Gemini call.
 *
 * Bounded to a batch per run rather than every user at once, both to stay
 * inside the function's time budget and to keep Gemini call volume sane --
 * oldest-computed-first means everyone eventually gets covered across runs.
 */

export const maxDuration = 300;

const BATCH_SIZE = 25;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json({ skipped: 'GEMINI_API_KEY not configured' });
  }

  const supabase = createServiceRoleClient();

  const { data: topics } = await supabase.from('knowledge_graph').select('*').returns<KnowledgeGraphRow[]>();
  const knownTopics = topics ?? [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, subjects')
    .not('onboarding_completed_at', 'is', null)
    .order('updated_at', { ascending: true })
    .limit(BATCH_SIZE)
    .returns<Pick<ProfileRow, 'id' | 'subjects'>[]>();

  const results: { userId: string; predictionsCreated: number }[] = [];

  for (const profile of profiles ?? []) {
    const vulnerabilityModel = await ensureVulnerabilityModel(supabase, profile.id, knownTopics);

    const { count: pendingCount } = await supabase
      .from('predicted_errors')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('outcome', 'pending');

    let created = 0;
    if (!pendingCount) {
      created = await generatePredictedErrors(
        supabase,
        profile.id,
        profile.subjects,
        vulnerabilityModel.patterns as Record<
          string,
          { label: string; weight: number; evidenceCount: number; relatedTopicIds: string[] }
        >,
      );
    }
    results.push({ userId: profile.id, predictionsCreated: created });
  }

  return NextResponse.json({ processed: results.length, results });
}
