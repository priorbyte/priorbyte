import type { Metadata } from 'next';
import type { CampusListingRow } from '@priorbyte/shared/database';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PostForm } from './post-form';
import { ListingCard } from './listing-card';

export const metadata: Metadata = { title: 'Campus Opportunities' };

export default async function MarketplacePage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: listings } = await supabase
    .from('campus_listings')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<CampusListingRow[]>();

  const open = (listings ?? []).filter((l) => l.status === 'open' || l.status === 'claimed');
  const mine = (listings ?? []).filter(
    (l) => l.status === 'completed' || l.status === 'cancelled',
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="pb-label">Campus Opportunities</p>
        <h1 className="mt-2 text-4xl">Trade time, skills, and help.</h1>
        <p className="mt-2 max-w-2xl text-silver">
          A gig board for verified students only — post a task, claim someone else's, settle payment
          directly between yourselves. Priorbyte doesn't take a cut and doesn't handle the money.
        </p>
      </div>

      <PostForm />

      <div className="space-y-3">
        {open.length === 0 ? (
          <p className="text-sm text-muted">No open listings yet — be the first to post one.</p>
        ) : (
          open.map((listing) => (
            <ListingCard key={listing.id} listing={listing} currentUserId={profile.id} />
          ))
        )}
      </div>

      {mine.length > 0 && (
        <details className="pb-panel">
          <summary className="cursor-pointer pb-label">Closed listings</summary>
          <div className="mt-3 space-y-3">
            {mine.map((listing) => (
              <ListingCard key={listing.id} listing={listing} currentUserId={profile.id} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
