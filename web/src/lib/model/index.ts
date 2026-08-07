import { FallbackModel } from './fallback-provider';
import { GeminiModel } from './gemini-provider';
import { LocalModel } from './local-provider';
import type { PriorbyteModel } from './types';

export type { ChatTurn, GenerationOptions, PriorbyteModel } from './types';

/**
 * The single place that decides which model backs every AI feature in the
 * app. When LOCAL_MODEL_URL is set (a fine-tuned model running on
 * borrowed/local GPU hardware, tunneled to a public URL), it becomes the
 * primary provider with Gemini as an automatic fallback — so a laptop that's
 * off, asleep, or between tunnel restarts doesn't take the whole app's AI
 * features down with it. Without LOCAL_MODEL_URL, this is just Gemini.
 */
const gemini = new GeminiModel();
export const model: PriorbyteModel = process.env.LOCAL_MODEL_URL
  ? new FallbackModel(new LocalModel(), gemini)
  : gemini;
