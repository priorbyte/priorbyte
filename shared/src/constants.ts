/** Cross-app constants: tiers, limits, and enum-like unions shared by web/extension/backend. */

export const USER_ROLES = ['student', 'faculty', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SUBSCRIPTION_TIERS = ['free', 'pro', 'teams', 'enterprise'] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

/** Ghost Timeline stages, in order. */
export const TIMELINE_STAGES = ['believed', 'learned', 'practiced', 'mastered'] as const;
export type TimelineStage = (typeof TIMELINE_STAGES)[number];

/** Per-course chat visibility for staff. Default is always `none`. */
export const CHAT_SHARING_LEVELS = ['none', 'selected', 'full'] as const;
export type ChatSharingLevel = (typeof CHAT_SHARING_LEVELS)[number];

/** Kinds of passively captured learning events. */
export const LEARNING_EVENT_TYPES = [
  'note',
  'question',
  'answer',
  'correction',
  'quiz_attempt',
  'code_submission',
  'reading',
  'video',
] as const;
export type LearningEventType = (typeof LEARNING_EVENT_TYPES)[number];

/** Inoculation micro-content formats produced by the Inoculation Engine. */
export const INOCULATION_FORMATS = ['story', 'puzzle', 'analogy', 'counterexample'] as const;
export type InoculationFormat = (typeof INOCULATION_FORMATS)[number];

/** Outcome of a predicted error once the student reached the topic. */
export const PREDICTION_OUTCOMES = ['pending', 'prevented', 'occurred', 'expired'] as const;
export type PredictionOutcome = (typeof PREDICTION_OUTCOMES)[number];

/** Tier limits. `null` means unlimited. */
export const TIER_LIMITS: Record<
  SubscriptionTier,
  { aiQueriesPerMonth: number | null; inoculationsPerWeek: number | null; oracleCadence: string }
> = {
  free: { aiQueriesPerMonth: 10, inoculationsPerWeek: 3, oracleCadence: 'weekly' },
  pro: { aiQueriesPerMonth: null, inoculationsPerWeek: null, oracleCadence: 'daily' },
  teams: { aiQueriesPerMonth: null, inoculationsPerWeek: null, oracleCadence: 'daily' },
  enterprise: { aiQueriesPerMonth: null, inoculationsPerWeek: null, oracleCadence: 'daily' },
};

/** Voyage AI embedding dimensions — must match the pgvector column width. */
export const EMBEDDING_DIMENSIONS = 1024;
