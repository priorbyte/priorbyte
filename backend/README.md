# @priorbyte/backend

Supabase project configuration, SQL migrations, RLS policies, and Edge Functions.

## Layout

```
supabase/
  migrations/    numbered SQL migrations — schema + RLS, always together
  functions/     Edge Functions (Deno)
```

## Rules

- **RLS on every table, from the first migration.** A table ships with its
  policies in the same migration file; never a migration that creates a table
  without enabling RLS.
- Student-owned tables filter on `auth.uid() = user_id`.
- `chat_history` reads by a non-owner must additionally pass a
  `chat_sharing_consent` check. There is no bulk export path for staff.
- The service-role key is server-only. It never reaches `/web` client code or
  `/extension`.

## Applying migrations

Requires the Supabase CLI and a linked project:

```bash
pnpm --filter @priorbyte/backend db:push
```

Schema and policies are written in **step 2**.

## Manual dashboard steps

**Signup domain allowlist (migration `20260803000100`)** — enforcement is a
Postgres function, but wiring it to actually run is a dashboard-only step
(Auth Hooks aren't SQL-configurable):

1. **Authentication → Hooks** → add hook, type **Before User Created**
2. Point it at `public.before_user_created_hook`
3. To actually restrict signups, insert allowed domains — an empty table
   means unrestricted:
   ```sql
   insert into public.allowed_email_domains (domain) values ('youruniversity.edu');
   ```

**Shorten the magic-link expiry** (recommended alongside the rate limiting in
the same migration): **Authentication → Providers → Email → Email OTP
Expiration** — the dashboard default is 3600s (1 hour); 900s (15 min) is
tighter without being disruptive.

**Built-in Auth rate limits** (separate from and in addition to the
`magic_link_attempts` table): **Authentication → Rate Limits** — Supabase
ships sane defaults; only touch this if you have a specific reason to.
