'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export interface AdminActionResult {
  ok: boolean;
  message?: string;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function createTopic(_prev: AdminActionResult, formData: FormData): Promise<AdminActionResult> {
  await requireAdmin();

  const title = String(formData.get('title') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim();
  const misconceptions = String(formData.get('misconceptions') ?? '')
    .split('\n')
    .map((m) => m.trim())
    .filter(Boolean);

  if (!title || !subject) return { ok: false, message: 'Title and subject are required.' };

  const supabase = createClient();
  const { error } = await supabase.from('knowledge_graph').insert({
    slug: slugify(title),
    title,
    subject,
    summary: summary || null,
    misconceptions,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/knowledge-graph');
  return { ok: true };
}

export async function deleteTopic(topicId: string): Promise<AdminActionResult> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from('knowledge_graph').delete().eq('id', topicId);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/knowledge-graph');
  return { ok: true };
}

export async function addPrerequisite(
  topicId: string,
  prerequisiteId: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (topicId === prerequisiteId) return { ok: false, message: 'A topic cannot require itself.' };

  const supabase = createClient();
  const { error } = await supabase
    .from('knowledge_graph_edges')
    .insert({ topic_id: topicId, prerequisite_id: prerequisiteId });
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/knowledge-graph');
  return { ok: true };
}

export async function removePrerequisite(
  topicId: string,
  prerequisiteId: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase
    .from('knowledge_graph_edges')
    .delete()
    .eq('topic_id', topicId)
    .eq('prerequisite_id', prerequisiteId);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/knowledge-graph');
  return { ok: true };
}
