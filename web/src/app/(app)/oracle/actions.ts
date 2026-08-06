'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Resolving outcome goes through the user's own session client — the
 * guard_predicted_error_updates trigger now explicitly permits exactly this
 * one transition (pending -> prevented/occurred, once). Building the Ghost
 * Fork needs the service-role client instead: ghost_forks has no owner-insert
 * policy at all (it's pipeline-written by design), so a self-report action
 * has to go through service role for that one write — still filtered by an
 * explicit user_id we resolved ourselves, not trusting the client.
 */
export async function resolvePrediction(
  predictionId: string,
  outcome: 'prevented' | 'occurred',
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const resolvedAt = new Date().toISOString();

  const { data: predictedError, error } = await supabase
    .from('predicted_errors')
    .update({ outcome, resolved_at: resolvedAt })
    .eq('id', predictionId)
    .eq('user_id', user.id)
    .eq('outcome', 'pending')
    .select('*')
    .single();

  if (error || !predictedError) return;

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
          {
            stage: 'believed',
            summary: predictedError.prediction,
            occurredAt: predictedError.predicted_at,
          },
          {
            stage: 'learned',
            summary: (predictedError.inoculation_content ?? '').slice(0, 300),
            occurredAt: predictedError.inoculation_delivered_at,
          },
          { stage: 'practiced', summary: 'Avoided the predicted mistake.', occurredAt: resolvedAt },
        ]
      : [
          {
            stage: 'believed',
            summary: predictedError.prediction,
            occurredAt: predictedError.predicted_at,
          },
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

  revalidatePath('/oracle');
  revalidatePath('/dashboard');
}

export async function acknowledgeInoculation(predictionId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('predicted_errors')
    .update({ inoculation_acknowledged_at: new Date().toISOString() })
    .eq('id', predictionId)
    .eq('user_id', user.id)
    .is('inoculation_acknowledged_at', null);

  revalidatePath('/oracle');
}
