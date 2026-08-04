import { EMBEDDING_DIMENSIONS } from '@priorbyte/shared/constants';

type VoyageInputType = 'query' | 'document';

/**
 * Voyage AI embeddings. Never throws — returns null (or an array of nulls
 * for the batch form) on a missing key or any API failure, so callers can
 * fall back to keyword search instead of crashing the page.
 */
async function callVoyage(
  input: string | string[],
  inputType: VoyageInputType,
): Promise<(number[] | null)[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input, model: 'voyage-3', input_type: inputType }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { data?: { embedding?: number[]; index?: number }[] };
    if (!data.data) return null;

    return data.data.map((d) =>
      d.embedding && d.embedding.length === EMBEDDING_DIMENSIONS ? d.embedding : null,
    );
  } catch {
    return null;
  }
}

/** Embeds search-time text. Voyage tunes `query` vs `document` embeddings differently. */
export async function embedQuery(text: string): Promise<number[] | null> {
  const result = await callVoyage(text, 'query');
  return result?.[0] ?? null;
}

/** Embeds one piece of captured content for storage. */
export async function embedDocument(text: string): Promise<number[] | null> {
  const result = await callVoyage(text, 'document');
  return result?.[0] ?? null;
}

/** Embeds many documents in a single API call — used by the backfill pass. */
export async function embedDocuments(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  const result = await callVoyage(texts, 'document');
  return result ?? texts.map(() => null);
}

/** pgvector's text input format over PostgREST: a bracketed, comma-separated list. */
export function toPgVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export function isVoyageConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}
