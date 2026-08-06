export interface ChatTurn {
  role: 'user' | 'model';
  content: string;
}

export interface GenerationOptions {
  maxOutputTokens?: number;
  temperature?: number;
}

/**
 * The provider-agnostic contract every Priorbyte AI feature is written
 * against: the AI Tutor, all 8 Learning Tools, Psychic Lattice, and Error
 * Oracle call only these four methods. Gemini is the only implementation
 * today (`GeminiModel`), but nothing above this interface knows that — a
 * future custom-trained model becomes a second class implementing the same
 * four methods, wired up in `./index.ts`, with zero changes to any caller.
 */
export interface PriorbyteModel {
  isConfigured(): boolean;

  /** Multi-turn chat — the AI Tutor's only mode. */
  chat(history: ChatTurn[]): Promise<string | null>;

  /** Single-turn, free-text output — summarizers, simplifiers, etc. */
  generateText(
    systemPrompt: string,
    userPrompt: string,
    options?: GenerationOptions,
  ): Promise<string | null>;

  /** Single-turn, schema-constrained JSON output — flashcards, quizzes, predictions. */
  generateJSON<T>(systemPrompt: string, userPrompt: string, responseSchema: object): Promise<T | null>;

  /** Single-turn, document input (e.g. a PDF) alongside an instruction. */
  generateFromDocument(
    systemPrompt: string,
    instruction: string,
    base64Data: string,
    mimeType: string,
  ): Promise<string | null>;
}
