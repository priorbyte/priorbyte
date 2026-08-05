export interface ChatTurn {
  role: 'user' | 'model';
  content: string;
}

const TUTOR_SYSTEM_PROMPT = `You are the Priorbyte AI Tutor — part of a learning immune system, not a
generic assistant. Help the student understand the underlying concept rather than just
handing over an answer. Be concise. When they've made a mistake, name it plainly and explain
why it happened, not just what the correct answer is.`;

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

interface GenerationConfig {
  maxOutputTokens?: number;
  temperature?: number;
  responseMimeType?: 'text/plain' | 'application/json';
  responseSchema?: object;
}

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

/**
 * Low-level call to Gemini's generateContent endpoint. Returns null (never
 * throws) on missing config or any API failure, so callers can show a clean
 * error instead of a 500.
 *
 * "latest" alias rather than a pinned version: some pinned model names
 * (gemini-2.0-flash, gemini-2.5-flash) returned a hard 0-quota or a
 * "no longer available to new users" 404 on a freshly created key — the
 * alias reliably resolves to whatever the account actually has free-tier
 * access to.
 */
async function callGemini(
  systemPrompt: string,
  contents: { role: string; parts: GeminiPart[] }[],
  generationConfig: GenerationConfig = {},
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
            ...generationConfig,
          },
        }),
      },
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim() || null;
  } catch {
    return null;
  }
}

/** Multi-turn chat — used by the AI Tutor. */
export async function askGemini(history: ChatTurn[]): Promise<string | null> {
  return callGemini(
    TUTOR_SYSTEM_PROMPT,
    history.map((turn) => ({ role: turn.role, parts: [{ text: turn.content }] })),
  );
}

/** Single-turn, free-text output — used by tools like the Notes Summarizer. */
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  return callGemini(systemPrompt, [{ role: 'user', parts: [{ text: userPrompt }] }], {
    maxOutputTokens: 2048,
  });
}

/**
 * Single-turn, schema-constrained JSON output — used by tools that need
 * structured data back (flashcards, quiz questions) rather than prose to
 * parse with regex. `responseSchema` follows Gemini's subset of the OpenAPI
 * schema format.
 */
export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  responseSchema: object,
): Promise<T | null> {
  const raw = await callGemini(systemPrompt, [{ role: 'user', parts: [{ text: userPrompt }] }], {
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
    responseSchema,
  });
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Single-turn, document input — used by the PDF Reader. Sends the file
 * inline as base64 rather than shelling out to a PDF-parsing library:
 * Gemini's multimodal models read PDF content natively, so no new
 * dependency is needed for text extraction.
 */
export async function generateTextFromDocument(
  systemPrompt: string,
  instruction: string,
  base64Data: string,
  mimeType: string,
): Promise<string | null> {
  return callGemini(
    systemPrompt,
    [
      {
        role: 'user',
        parts: [{ inline_data: { mime_type: mimeType, data: base64Data } }, { text: instruction }],
      },
    ],
    { maxOutputTokens: 2048 },
  );
}
