import { model, type ChatTurn, type GenerationOptions } from './model';

export type { ChatTurn, GenerationOptions };

/**
 * Backward-compatible shim over the provider-agnostic model layer in
 * ./model — every caller in the app still imports from here by name, so
 * this file exists purely to avoid touching 20 call sites for what is
 * otherwise an internal refactor. New code should prefer importing `model`
 * from './model' directly.
 */

export function isGeminiConfigured(): boolean {
  return model.isConfigured();
}

export async function askGemini(history: ChatTurn[]): Promise<string | null> {
  return model.chat(history);
}

export async function generateText(systemPrompt: string, userPrompt: string): Promise<string | null> {
  return model.generateText(systemPrompt, userPrompt);
}

export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  responseSchema: object,
  options?: GenerationOptions,
): Promise<T | null> {
  return model.generateJSON<T>(systemPrompt, userPrompt, responseSchema, options);
}

export async function generateTextFromDocument(
  systemPrompt: string,
  instruction: string,
  base64Data: string,
  mimeType: string,
): Promise<string | null> {
  return model.generateFromDocument(systemPrompt, instruction, base64Data, mimeType);
}
