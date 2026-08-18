import { NextResponse, type NextRequest } from 'next/server';
import { getMobileUser } from '@/lib/mobile-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Mobile equivalent of resolvePrediction in
 * web/src/app/(app)/oracle/actions.ts. The ghost_forks insert needs the
 * service-role client (that table has no owner-insert policy by design), so
 * this can't just be a direct Supabase call from the app the way
 * acknowledgeInoculation can — it has to go through a trusted server route.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { supabase, user } = await getMobileUser(request);
  if (!supabase || !user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const predictionId = typeof body?.predictionId === 'string' ? body.predictionId : null;
  const outcome = body?.outcome === 'prevented' || body?.outcome === 'occurred' ? body.outcome : null;
  if (!predictionId || !outcome) {
    return NextResponse.json({ error: 'Missing predictionId or outcome.' }, { status: 400 });
  }

  const resolvedAt = new Date().toISOString();

  const { data: predictedError, error } = await supabase
    .from('predicted_errors')
    .update({ outcome, resolved_at: resolvedAt })
    .eq('id', predictionId)
    .eq('user_id', user.id)
    .eq('outcome', 'pending')
    .select('*')
    .single();

  if (error || !predictedError) {
    return NextResponse.json({ error: error?.message ?? 'Could not resolve prediction.' }, { status: 400 });
  }

  const originalPath = [
    { stage: 'believed', summary: predictedError.prediction, occurredAt: predictedError.predicted_at },
    {
      stage: 'practiced',
      summary: 'Without inoculation, this mistake would likely have recurred.',
      occurredAt: null,
    },
  ];

  const protectedPath =
    outcome === 'prevented'
      ? [
          { stage: 'believed', summary: predictedError.prediction, occurredAt: predictedError.predicted_at },
          {
            stage: 'learned',
            summary: (predictedError.inoculation_content ?? '').slice(0, 300),
            occurredAt: predictedError.inoculation_delivered_at,
          },
          { stage: 'practiced', summary: 'Avoided the predicted mistake.', occurredAt: resolvedAt },
        ]
      : [
          { stage: 'believed', summary: predictedError.prediction, occurredAt: predictedError.predicted_at },
          {
            stage: 'practiced',
            summary: 'Made the predicted mistake despite the inoculation.',
            occurredAt: resolvedAt,
          },
        ];

  const serviceClient = createServiceRoleClient();
  await serviceClient.from('ghost_forks').insert({
    user_id: user.id,
    topic_id: predictedError.topic_id,
    predicted_error_id: predictedError.id,
    original_path: originalPath,
    protected_path: protectedPath,
    stages_saved: outcome === 'prevented' ? 1 : 0,
  });

  return NextResponse.json({ ok: true });
}
