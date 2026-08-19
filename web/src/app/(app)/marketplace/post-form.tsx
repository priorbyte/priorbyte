'use client';

import { useRef, useState, useTransition } from 'react';
import { postListing } from './actions';

const CATEGORIES = ['Assignment Help', 'Tutoring', 'Design', 'Writing', 'Other'];

export function PostForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await postListing(formData);
      if (!result.ok) {
        setError(result.message ?? 'Something went wrong.');
        return;
      }
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="pb-panel space-y-3">
      <p className="pb-label">Post a listing</p>
      <input
        name="title"
        placeholder="Title (e.g. Need help with a lab report)"
        maxLength={120}
        required
        className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white placeholder:text-muted"
      />
      <select
        name="category"
        required
        defaultValue=""
        className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white"
      >
        <option value="" disabled>
          Category
        </option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <textarea
        name="description"
        placeholder="What do you need, and what's the deal — timeline, what you're offering in return."
        rows={4}
        maxLength={2000}
        required
        className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white placeholder:text-muted"
      />
      {error && (
        <p className="text-xs text-amber" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-cyan px-6 py-2 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
      >
        {pending ? 'Posting…' : 'Post listing'}
      </button>
      <p className="text-xs text-muted">
        Payment and pickup terms are worked out directly with whoever claims this — Priorbyte doesn't handle money.
      </p>
    </form>
  );
}
