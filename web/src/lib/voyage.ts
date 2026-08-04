import { EMBEDDING_DIMENSIONS } from '@priorbyte/shared/constants';

/**
 * Voyage AI embeddings. Returns null (never throws) when unconfigured or on
 * any API failure — callers fall back to keyword search rather than crash.
 */
export async function embedQuery(text: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: 'voyage-3',
        input_type: 'query',
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { data?: { embedding?: number[] }[] };
    const embedding = data.data?.[0]?.embedding;
    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) return null;

    return embedding;
  } catch {
    return null;
  }
}

/** pgvector's text input format over PostgREST: a bracketed, comma-separated list. */
export function toPgVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export function isVoyageConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}
