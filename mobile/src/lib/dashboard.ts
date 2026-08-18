/**
 * Ported directly from web/src/lib/dashboard.ts so streak/consistency math
 * matches exactly between the web and mobile clients — same inputs must
 * produce the same numbers on both. Keep in sync with that file.
 */

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function daysSince(date: Date): number {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return Math.floor((todayUTC().getTime() - start.getTime()) / 86_400_000);
}

/** Distinct calendar dates (UTC) on which at least one event occurred. */
export function toActiveDateSet(timestamps: string[]): Set<string> {
  return new Set(timestamps.map((t) => toDateKey(new Date(t))));
}

/**
 * Consecutive days of activity ending today or yesterday — a day with no
 * activity yet (today, before the student has done anything) doesn't break
 * a streak that's still "alive" as of yesterday.
 */
export function computeStreak(activeDates: Set<string>): number {
  const cursor = todayUTC();
  if (!activeDates.has(toDateKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while (activeDates.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/** % of days active over the last `windowDays`, capped to the account's age. */
export function computeConsistency(
  activeDates: Set<string>,
  accountCreatedAt: Date,
  windowDays = 30,
): number {
  const effectiveWindow = Math.min(windowDays, daysSince(accountCreatedAt) + 1);
  if (effectiveWindow <= 0) return 0;

  const cursor = todayUTC();
  let activeCount = 0;
  for (let i = 0; i < effectiveWindow; i++) {
    if (activeDates.has(toDateKey(cursor))) activeCount += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return Math.round((activeCount / effectiveWindow) * 100);
}

/** Time-of-day greeting in the student's own timezone, not the device's. */
export function getGreeting(timeZone: string): string {
  let hour = new Date().getUTCHours();
  try {
    hour = Number.parseInt(
      new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone }).format(
        new Date(),
      ),
      10,
    );
  } catch {
    // Invalid/unrecognized IANA zone — fall back to UTC hour rather than throw.
  }
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
