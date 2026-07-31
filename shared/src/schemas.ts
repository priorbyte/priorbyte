/** Zod schemas for anything crossing a trust boundary (API routes, extension → Supabase). */

import { z } from 'zod';
import {
  CHAT_SHARING_LEVELS,
  LEARNING_EVENT_TYPES,
  SUBSCRIPTION_TIERS,
  TIMELINE_STAGES,
  USER_ROLES,
} from './constants';

export const uuidSchema = z.string().uuid();
export const timestampSchema = z.string().datetime({ offset: true });

export const userRoleSchema = z.enum(USER_ROLES);
export const subscriptionTierSchema = z.enum(SUBSCRIPTION_TIERS);
export const timelineStageSchema = z.enum(TIMELINE_STAGES);
export const chatSharingLevelSchema = z.enum(CHAT_SHARING_LEVELS);
export const learningEventTypeSchema = z.enum(LEARNING_EVENT_TYPES);

/** Payload the Chrome extension POSTs for each captured learning event. */
export const captureLearningEventSchema = z.object({
  type: learningEventTypeSchema,
  content: z.string().min(1).max(20_000),
  topicSlug: z.string().min(1).max(200).optional(),
  source: z.string().url().max(2000).optional(),
  occurredAt: timestampSchema.optional(),
});
export type CaptureLearningEventInput = z.infer<typeof captureLearningEventSchema>;

/** Onboarding wizard — every field is optional because every step is skippable. */
export const onboardingSchema = z.object({
  goal: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  subjects: z.array(z.string().min(1).max(100)).max(20).optional(),
  diagnosticAnswers: z
    .array(z.object({ questionId: z.string(), answer: z.string().max(2000) }))
    .max(5)
    .optional(),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Magic-link sign-in — the only auth entry point. */
export const magicLinkSchema = z.object({
  email: z.string().email().max(320),
});
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

/** Student-initiated change to staff chat visibility for one course. */
export const chatSharingConsentSchema = z
  .object({
    courseId: uuidSchema,
    level: chatSharingLevelSchema,
    sharedConversationIds: z.array(uuidSchema).max(500).default([]),
  })
  .refine(
    (v) => v.level !== 'selected' || v.sharedConversationIds.length > 0,
    { message: 'Level "selected" requires at least one conversation id.', path: ['sharedConversationIds'] },
  );
export type ChatSharingConsentInput = z.infer<typeof chatSharingConsentSchema>;

/** Ghost Memory vector search over the student's own past mistakes. */
export const ghostMemoryQuerySchema = z.object({
  query: z.string().min(1).max(2000),
  limit: z.number().int().min(1).max(50).default(10),
  /** Cosine similarity floor, 0–1. */
  threshold: z.number().min(0).max(1).default(0.7),
});
export type GhostMemoryQueryInput = z.infer<typeof ghostMemoryQuerySchema>;
