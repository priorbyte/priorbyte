export interface ChatTurn {
  role: 'user' | 'model';
  content: string;
}

const SYSTEM_PROMPT = `You are the Priorbyte AI Tutor — part of a learning immune system, not a
generic assistant. Help the student understand the underlying concept rather than just
handing over an answer. Be concise. When they've made a mistake, name it plainly and explain
why it happened, not just what the correct answer is.`;

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Calls Gemini's generateContent endpoint. Returns null (never throws) on
 * missing config or any API failure, so callers can show a clean error
 * instead of a 500.
 */
export async function askGemini(history: ChatTurn[]): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: history.map((turn) => ({
            role: turn.role,
            parts: [{ text: turn.content }],
          })),
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
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
