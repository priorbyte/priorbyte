/**
 * Shown wherever a signed-in experience is impossible because the Supabase
 * project has not been wired up yet. Better than a stack trace, and it tells
 * whoever is running the app exactly what to do.
 */
export function SetupNotice() {
  return (
    <div className="pb-panel space-y-4 border-amber/40">
      <p className="pb-label text-amber">Backend not configured</p>
      <p className="text-sm text-silver">
        Priorbyte needs a Supabase project before sign-in works. Create one, then add these to{' '}
        <code className="font-mono text-cyan">web/.env.local</code>:
      </p>
      <pre className="overflow-x-auto rounded-lg border border-line bg-background p-4 font-mono text-xs text-silver">
        {`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000`}
      </pre>
      <p className="text-sm text-muted">
        Then apply the migrations in <code className="font-mono">backend/supabase/migrations</code>{' '}
        and restart the dev server.
      </p>
    </div>
  );
}
