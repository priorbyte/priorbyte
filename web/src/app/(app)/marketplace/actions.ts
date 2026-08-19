'use server';

import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export interface ListingActionResult {
  ok: boolean;
  message?: string;
}

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;

export async function postListing(formData: FormData): Promise<ListingActionResult> {
  const profile = await requireProfile();
  const supabase = createClient();

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();

  if (!title || !description || !category) return { ok: false, message: 'Fill out every field.' };
  if (title.length > MAX_TITLE_LENGTH) return { ok: false, message: 'Title is too long.' };
  if (description.length > MAX_DESCRIPTION_LENGTH) return { ok: false, message: 'Description is too long.' };

  const { error } = await supabase.from('campus_listings').insert({
    posted_by: profile.id,
    title,
    description,
    category,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath('/marketplace');
  return { ok: true };
}

export async function claimListing(listingId: string): Promise<ListingActionResult> {
  const profile = await requireProfile();
  const supabase = createClient();

  const { error } = await supabase
    .from('campus_listings')
    .update({ status: 'claimed', claimed_by: profile.id, claimed_at: new Date().toISOString() })
    .eq('id', listingId)
    .eq('status', 'open');

  if (error) return { ok: false, message: error.message };

  revalidatePath('/marketplace');
  return { ok: true };
}

export async function completeListing(listingId: string): Promise<ListingActionResult> {
  const profile = await requireProfile();
  const supabase = createClient();

  const { error } = await supabase
    .from('campus_listings')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', listingId)
    .eq('posted_by', profile.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/marketplace');
  return { ok: true };
}

export async function cancelListing(listingId: string): Promise<ListingActionResult> {
  const profile = await requireProfile();
  const supabase = createClient();

  const { error } = await supabase
    .from('campus_listings')
    .delete()
    .eq('id', listingId)
    .eq('posted_by', profile.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/marketplace');
  return { ok: true };
}
