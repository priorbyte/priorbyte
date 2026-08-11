import type { ChatTurn, GenerationOptions, PriorbyteModel } from './types';

/**
 * Talks to an OpenAI-compatible chat completions endpoint — the shape Ollama
 * and LM Studio both expose at POST {baseUrl}/v1/chat/completions. Meant for
 * a model run on borrowed/local GPU hardware (e.g. a laptop) while the
 * product is still pre-revenue: free to run, at the cost of only being
 * reachable while that machine is on and tunneled to a public URL (ngrok,
 * Cloudflare Tunnel, etc.) set as LOCAL_MODEL_URL.
 *
 * Document input (PDF reading) works differently here than in GeminiModel:
 * a local text model has no native way to read a PDF's raw bytes the way
 * Gemini's multimodal endpoint does, so this extracts the PDF's text
 * locally first (pdf-parse, pure JS, no external API call) and feeds that
 * extracted text through the same chat-completion path as any other text
 * task. This only sees the document's text layer — a scanned PDF that's
 * actually just images, or diagrams/charts with no text content, produce
 * little or nothing to summarize, which Gemini's true multimodal reading
 * could still handle. That gap is exactly what the Gemini fallback in
 * FallbackModel exists to cover.
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

  async generateFromDocument(
    systemPrompt: string,
    instruction: string,
    base64Data: string,
    mimeType: string,
  ): Promise<string | null> {
    if (mimeType !== 'application/pdf') return null;

    // Loaded on demand, not at module scope: pdf-parse pulls in pdfjs-dist,
    // which references browser-only APIs (DOMMatrix) at import time in
    // Vercel's Node serverless runtime. A top-level import broke every
    // route that touches this file — chat, text, JSON, all of it — not just
    // PDF reading. A dynamic import here means only an actual PDF-reading
    // request ever loads it, and the try/catch below means even a genuinely
    // broken environment degrades to "fall through to Gemini" instead of
    // taking anything else down with it.
    let extractedText: string;
    try {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: Buffer.from(base64Data, 'base64') });
      try {
        const result = await parser.getText();
        extractedText = result.text.trim();
      } finally {
        await parser.destroy();
      }
    } catch {
      return null;
    }

    if (!extractedText) {
      // No text layer at all (a scanned/image-only PDF) -- nothing for a
      // text model to summarize. Falling through to Gemini gives it a real
      // shot via actual multimodal reading instead of failing outright.
      return null;
    }

    return this.complete(systemPrompt, `${instruction}\n\nDocument text:\n${extractedText}`, {
      maxOutputTokens: 8192,
    });
  }
}
