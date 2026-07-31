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
