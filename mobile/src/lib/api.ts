import { supabase } from './supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  throw new Error(
    'EXPO_PUBLIC_API_BASE_URL is not set in mobile/.env.local — this should point at the ' +
      'deployed Priorbyte web app (e.g. https://priorbyte.vercel.app), since the AI Tutor and ' +
      'Learning Tools run through its /api/mobile/* routes, not directly from this app.',
  );
}

/**
 * Attaches the current Supabase session's access token as a bearer header —
 * every /api/mobile/* route on the web backend authenticates this way
 * (there's no cookie to send from a native app). Throws if there's no
 * session; every call site here only runs once RouteGuard has already
 * confirmed the user is signed in.
 */
async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in.');

  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await authedFetch(path);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

export async function apiPost<T>(path: string, data: unknown): Promise<T> {
  const res = await authedFetch(path, { method: 'POST', body: JSON.stringify(data) });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}
