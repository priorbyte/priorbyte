import type { ChatTurn, GenerationOptions, PriorbyteModel } from './types';

/**
 * Tries `primary` first, falls back to `secondary` if primary returns null
 * (not configured, timed out, or genuinely failed). This is what makes
 * running a fine-tuned model on a laptop viable in production: when the
 * laptop is off, the tunnel is down, or it's mid-reboot, requests fail over
 * to Gemini instead of the feature just breaking for whoever hit it.
 */
export class FallbackModel implements PriorbyteModel {
  constructor(
    private readonly primary: PriorbyteModel,
    private readonly secondary: PriorbyteModel,
  ) {}

  isConfigured(): boolean {
    return this.primary.isConfigured() || this.secondary.isConfigured();
  }

  async chat(history: ChatTurn[]): Promise<string | null> {
    return (await this.primary.chat(history)) ?? this.secondary.chat(history);
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options?: GenerationOptions,
  ): Promise<string | null> {
    return (
      (await this.primary.generateText(systemPrompt, userPrompt, options)) ??
      this.secondary.generateText(systemPrompt, userPrompt, options)
    );
  }

  async generateJSON<T>(
    systemPrompt: string,
    userPrompt: string,
    responseSchema: object,
  ): Promise<T | null> {
    return (
      (await this.primary.generateJSON<T>(systemPrompt, userPrompt, responseSchema)) ??
      this.secondary.generateJSON<T>(systemPrompt, userPrompt, responseSchema)
    );
  }

  async generateFromDocument(
    systemPrompt: string,
    instruction: string,
    base64Data: string,
    mimeType: string,
  ): Promise<string | null> {
    return (
      (await this.primary.generateFromDocument(systemPrompt, instruction, base64Data, mimeType)) ??
      this.secondary.generateFromDocument(systemPrompt, instruction, base64Data, mimeType)
    );
  }
}
