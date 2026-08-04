'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Renders nothing — just re-fetches the current Server Component on an interval. */
export function AutoRefresh({ intervalSeconds }: { intervalSeconds: number }) {
  const router = useRouter();

  useEffect(() => {
    if (intervalSeconds <= 0) return;
    const id = setInterval(() => router.refresh(), intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [intervalSeconds, router]);

  return null;
}
