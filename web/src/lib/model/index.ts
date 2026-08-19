import { FallbackModel } from './fallback-provider';
import { GeminiModel } from './gemini-provider';
import { GroqModel } from './groq-provider';
import { LocalModel } from './local-provider';
import type { PriorbyteModel } from './types';

export type { ChatTurn, GenerationOptions, PriorbyteModel } from './types';

/**
 * The single place that decides which model backs every AI feature in the
 * app. Chain, in order of preference: LocalModel (a fine-tuned model on
 * borrowed/local GPU hardware, when LOCAL_MODEL_URL is set) -> GroqModel
 * (fast LPU inference, when GROQ_API_KEY is set) -> Gemini as the final
 * fallback. Each layer only kicks in if the one before it is unconfigured,
 * down, or fails — so a laptop that's off or a rate-limited key never takes
 * the whole app's AI features down with it.
 */
const gemini = new GeminiModel();
const groqOrGemini: PriorbyteModel = process.env.GROQ_API_KEY
  ? new FallbackModel(new GroqModel(), gemini)
  : gemini;
export const model: PriorbyteModel = process.env.LOCAL_MODEL_URL
  ? new FallbackModel(new LocalModel(), groqOrGemini)
  : groqOrGemini;
