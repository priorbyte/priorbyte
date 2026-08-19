import type { ChatTurn, GenerationOptions, PriorbyteModel } from './types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Groq's inference API — OpenAI-compatible chat completions, but running on
 * Groq's LPU hardware, so it's dramatically faster than Gemini for the same
 * class of model. No vision/document input on the text models it serves
 * today, so generateFromDocument always returns null and lets FallbackModel
 * hand that one call off to Gemini.
 */
export class GroqModel implements PriorbyteModel {
  private readonly chatModel = 'llama-3.3-70b-versatile';

  isConfigured(): boolean {
    return Boolean(process.env.GROQ_API_KEY);
  }

  private async callGroq(
    messages: ChatMessage[],
    options: GenerationOptions & { responseFormat?: 'json_object' } = {},
  ): Promise<string | null> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.chatModel,
          messages,
          max_tokens: options.maxOutputTokens ?? 4096,
          temperature: options.temperature ?? 0.7,
          ...(options.responseFormat ? { response_format: { type: options.responseFormat } } : {}),
        }),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
      };
      const choice = data.choices?.[0];
      const text = choice?.message?.content?.trim();
      if (!text) return null;

      if (choice?.finish_reason === 'length' && options.responseFormat !== 'json_object') {
        return `${text}\n\n[Response was cut off for length — try a shorter input, or ask to continue.]`;
      }

      return text;
    } catch {
      return null;
    }
  }

  async chat(history: ChatTurn[]): Promise<string | null> {
    return this.callGroq(
      history.map((turn) => ({ role: turn.role === 'model' ? 'assistant' : 'user', content: turn.content })),
    );
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options: GenerationOptions = {},
  ): Promise<string | null> {
    return this.callGroq(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { maxOutputTokens: 8192, ...options },
    );
  }

  async generateJSON<T>(
    systemPrompt: string,
    userPrompt: string,
    responseSchema: object,
    options?: GenerationOptions,
  ): Promise<T | null> {
    const raw = await this.callGroq(
      [
        {
          role: 'system',
          content: `${systemPrompt}\n\nRespond with JSON only, matching this schema exactly:\n${JSON.stringify(responseSchema)}`,
        },
        { role: 'user', content: userPrompt },
      ],
      { maxOutputTokens: 8192, ...options, responseFormat: 'json_object' },
    );
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
