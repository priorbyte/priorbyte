import { GeminiModel } from './gemini-provider';
import type { PriorbyteModel } from './types';

export type { ChatTurn, GenerationOptions, PriorbyteModel } from './types';

/**
 * The single place that decides which model backs every AI feature in the
 * app. Today there's exactly one provider (Gemini); when a trained
 * Priorbyte-specific model exists, it becomes a second class implementing
 * `PriorbyteModel` and this line is the only thing that changes.
 */
export const model: PriorbyteModel = new GeminiModel();
