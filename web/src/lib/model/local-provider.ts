import type { ChatTurn, GenerationOptions, PriorbyteModel } from './types';

/**
 * Talks to an OpenAI-compatible chat completions endpoint — the shape Ollama
 * exposes at POST {baseUrl}/v1/chat/completions. Meant for a fine-tuned
 * model run on borrowed/local GPU hardware (e.g. a laptop) while the product
 * is still pre-revenue: free to run, at the cost of only being reachable
 * while that machine is on and tunneled to a public URL (ngrok, Cloudflare
 * Tunnel, etc.) set as LOCAL_MODEL_URL.
 *
 * Document input (PDF reading) is deliberately NOT implemented here — a
 * fine-tuned Llama/Mistral/Qwen text model has no native way to read a PDF's
 * bytes the way Gemini's multimodal endpoint does. generateFromDocument
 * always returns null, which FallbackModel treats as "try the next
 * provider" rather than a hard failure.
 */
export class LocalModel implements PriorbyteModel {
  isConfigured(): boolean {
    return Boolean(process.env.LOCAL_MODEL_URL);
  }

  private async complete(
    systemPrompt: string,
    userPrompt: string,
    options: GenerationOptions & { jsonMode?: boolean } = {},
  ): Promise<string | null> {
    const baseUrl = process.env.LOCAL_MODEL_URL;
    if (!baseUrl) return null;

    const modelName = process.env.LOCAL_MODEL_NAME ?? 'llama3.1:8b';

    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // A short timeout matters more here than with a cloud provider — a
        // sleeping laptop or a dropped tunnel should fail fast so
        // FallbackModel can move on to Gemini, not hang the request.
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxOutputTokens ?? 4096,
          ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content?.trim() ?? null;
    } catch {
      return null;
    }
  }

  async chat(history: ChatTurn[]): Promise<string | null> {
    // Local models take a flat system+messages array rather than Gemini's
    // separate system_instruction field; the last user turn plus the rest of
    // history collapsed into the prompt keeps this simple without a second
    // request shape just for multi-turn.
    const systemPrompt =
      'You are the Priorbyte AI Tutor — part of a learning immune system, not a generic ' +
      'assistant. Help the student understand the underlying concept rather than just handing ' +
      'over an answer. Be concise. When they made a mistake, name it plainly and explain why.';
    const transcript = history.map((t) => `${t.role === 'user' ? 'Student' : 'Tutor'}: ${t.content}`).join('\n');
    return this.complete(systemPrompt, transcript);
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options: GenerationOptions = {},
  ): Promise<string | null> {
    return this.complete(systemPrompt, userPrompt, options);
  }

  async generateJSON<T>(
    systemPrompt: string,
    userPrompt: string,
    responseSchema: object,
  ): Promise<T | null> {
    const schemaHint = `\n\nRespond with ONLY valid JSON matching this shape, no prose: ${JSON.stringify(responseSchema)}`;
    const raw = await this.complete(systemPrompt, `${userPrompt}${schemaHint}`, { jsonMode: true });
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async generateFromDocument(): Promise<string | null> {
    return null;
  }
}
