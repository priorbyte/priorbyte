'use client';

import { useState, useTransition } from 'react';
import type { CampusListingRow } from '@priorbyte/shared/database';
import { claimListing, completeListing, cancelListing } from './actions';

const STATUS_LABEL: Record<CampusListingRow['status'], string> = {
  open: 'Open',
  claimed: 'Claimed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function ListingCard({ listing, currentUserId }: { listing: CampusListingRow; currentUserId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isOwner = listing.posted_by === currentUserId;
  const isClaimant = listing.claimed_by === currentUserId;

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message ?? 'Something went wrong.');
    });
  }

  return (
    <div className="pb-panel space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="pb-label">{listing.category}</p>
          <h3 className="mt-1 text-lg text-white">{listing.title}</h3>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
            listing.status === 'open'
              ? 'border-cyan/40 text-cyan'
              : listing.status === 'claimed'
                ? 'border-amber/40 text-amber'
                : 'border-line text-muted'
          }`}
        >
          {STATUS_LABEL[listing.status]}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-sm text-silver">{listing.description}</p>

      {error && (
        <p className="text-xs text-amber" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {listing.status === 'open' && !isOwner && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => claimListing(listing.id))}
            className="rounded-lg border border-cyan/40 px-4 py-2 text-sm text-cyan transition hover:bg-cyan/10 disabled:opacity-50"
          >
            Claim
          </button>
        )}
        {listing.status === 'claimed' && isOwner && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => completeListing(listing.id))}
            className="rounded-lg border border-cyan/40 px-4 py-2 text-sm text-cyan transition hover:bg-cyan/10 disabled:opacity-50"
          >
            Mark completed
          </button>
        )}
        {listing.status === 'open' && isOwner && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => cancelListing(listing.id))}
            className="rounded-lg border border-amber/40 px-4 py-2 text-sm text-amber transition hover:bg-amber/10 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        {isClaimant && listing.status === 'claimed' && (
          <p className="self-center text-xs text-muted">You claimed this — wait for the poster to mark it done.</p>
        )}
      </div>
    </div>
  );
}
