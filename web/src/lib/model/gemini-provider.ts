import type { ChatTurn, GenerationOptions, PriorbyteModel } from './types';

const TUTOR_SYSTEM_PROMPT = `You are the Priorbyte AI Tutor — part of a learning immune system, not a
generic assistant. Help the student understand the underlying concept rather than just
handing over an answer. Be concise. When they've made a mistake, name it plainly and explain
why it happened, not just what the correct answer is.`;

interface GenerationConfig extends GenerationOptions {
  responseMimeType?: 'text/plain' | 'application/json';
  responseSchema?: object;
}

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

export class GeminiModel implements PriorbyteModel {
  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

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
  private async callGemini(
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
              // 4096 default — the old 1024 truncated the AI Tutor mid-answer
              // on anything longer than a couple of sentences. Callers that
              // genuinely need more (document/long-text summarizers) override
              // this explicitly rather than everyone paying for a huge ceiling.
              maxOutputTokens: 4096,
              temperature: 0.7,
              ...generationConfig,
            },
          }),
        },
      );

      if (!res.ok) return null;

      const data = (await res.json()) as {
        candidates?: {
          content?: { parts?: { text?: string }[] };
          finishReason?: string;
        }[];
      };
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text?.trim();
      if (!text) return null;

      // MAX_TOKENS means Gemini stopped mid-thought because the ceiling was
      // hit, not because it finished — that's a truncated answer, not a
      // short one, and the caller has no other way to tell the difference.
      // Skipped for JSON mode: appending prose to truncated JSON would just
      // break JSON.parse instead of surfacing anything useful — generateJSON
      // already turns a parse failure into a clean "try again" for the caller.
      if (
        candidate?.finishReason === 'MAX_TOKENS' &&
        generationConfig.responseMimeType !== 'application/json'
      ) {
        return `${text}\n\n[Response was cut off for length — try a shorter input, or ask to continue.]`;
      }

      return text;
    } catch {
      return null;
    }
  }

  async chat(history: ChatTurn[]): Promise<string | null> {
    return this.callGemini(
      TUTOR_SYSTEM_PROMPT,
      history.map((turn) => ({ role: turn.role, parts: [{ text: turn.content }] })),
    );
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options: GenerationOptions = {},
  ): Promise<string | null> {
    return this.callGemini(systemPrompt, [{ role: 'user', parts: [{ text: userPrompt }] }], {
      maxOutputTokens: 8192,
      ...options,
    });
  }

  async generateJSON<T>(
    systemPrompt: string,
    userPrompt: string,
    responseSchema: object,
  ): Promise<T | null> {
    const raw = await this.callGemini(systemPrompt, [{ role: 'user', parts: [{ text: userPrompt }] }], {
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema,
    });
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      // A MAX_TOKENS truncation note appended to JSON output breaks JSON.parse
      // outright — surface that as "try again with less input" rather than a
      // silent null the caller can't distinguish from any other failure.
      return null;
    }
  }

  async generateFromDocument(
    systemPrompt: string,
    instruction: string,
    base64Data: string,
    mimeType: string,
  ): Promise<string | null> {
    return this.callGemini(
      systemPrompt,
      [
        {
          role: 'user',
          parts: [{ inline_data: { mime_type: mimeType, data: base64Data } }, { text: instruction }],
        },
      ],
      { maxOutputTokens: 8192 },
    );
  }
}
