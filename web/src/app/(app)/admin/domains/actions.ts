'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export interface AdminActionResult {
  ok: boolean;
  message?: string;
}

const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export async function addDomain(_prev: AdminActionResult, formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();

  const domain = String(formData.get('domain') ?? '').trim().toLowerCase();
  if (!DOMAIN_PATTERN.test(domain)) {
    return { ok: false, message: 'Enter a bare domain, e.g. karunya.edu.in (no @, no https://).' };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('allowed_email_domains')
    .insert({ domain, added_by: admin.id });

  if (error) {
    if (error.code === '23505') return { ok: false, message: 'That domain is already allowed.' };
    return { ok: false, message: error.message };
  }

  revalidatePath('/admin/domains');
  return { ok: true };
}

export async function removeDomain(domain: string): Promise<AdminActionResult> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from('allowed_email_domains').delete().eq('domain', domain);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/domains');
  return { ok: true };
}
