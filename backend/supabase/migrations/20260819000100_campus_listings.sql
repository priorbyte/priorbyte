-- Priorbyte — Campus Opportunities: a peer-to-peer gig board.
--
-- Every signed-up account is already verified against a single allowed
-- email domain (see 20260806000100_karunya_domain_restriction.sql), so the
-- whole app is already one campus — no separate institution column or
-- geo-fence is needed for "verified students only," unlike a multi-campus
-- product like empty. Payment is negotiated and settled off-platform
-- (UPI/cash), so there's no escrow or payments schema here — this table is
-- just the listing board itself: post a task, someone claims it, mark done.

create type public.listing_status as enum ('open', 'claimed', 'completed', 'cancelled');

create table public.campus_listings (
  id uuid primary key default gen_random_uuid(),
  posted_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  status public.listing_status not null default 'open',
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campus_listings_status_idx on public.campus_listings (status, created_at desc);
create index campus_listings_posted_by_idx on public.campus_listings (posted_by);
create index campus_listings_claimed_by_idx on public.campus_listings (claimed_by);

create trigger campus_listings_set_updated_at
  before update on public.campus_listings
  for each row execute function public.set_updated_at();

alter table public.campus_listings enable row level security;

-- Every authenticated account is already a verified student on the single
-- allowed domain, so any signed-in user can browse the whole board.
create policy "listings: signed-in users read all"
  on public.campus_listings for select
  using (auth.uid() is not null);

create policy "listings: student creates own"
  on public.campus_listings for insert
  with check (auth.uid() = posted_by);

-- Poster can edit/cancel their own listing at any time; a claimant can only
-- update the row to move status open -> claimed (claiming it) or
-- claimed -> completed (marking their own pickup done), never touch anyone
-- else's fields.
create policy "listings: poster manages own"
  on public.campus_listings for update
  using (auth.uid() = posted_by)
  with check (auth.uid() = posted_by);

create policy "listings: claimant claims open listing"
  on public.campus_listings for update
  using (status = 'open' and auth.uid() is not null)
  with check (claimed_by = auth.uid() and status = 'claimed');

create policy "listings: poster deletes own"
  on public.campus_listings for delete
  using (auth.uid() = posted_by);
