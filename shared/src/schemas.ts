/** Zod schemas for anything crossing a trust boundary (API routes, extension → Supabase). */

import { z } from 'zod';
import {
  ACCENT_COLORS,
  CHAT_SHARING_LEVELS,
  DASHBOARD_WIDGETS,
  LEARNING_EVENT_TYPES,
  REFRESH_INTERVALS,
  SELF_SERVICE_ROLES,
  SUBSCRIPTION_TIERS,
  THEME_MODES,
  TIMELINE_STAGES,
  USER_ROLES,
  YEAR_LEVELS,
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
export const selfServiceRoleSchema = z.enum(SELF_SERVICE_ROLES);
export const yearLevelSchema = z.enum(YEAR_LEVELS);

/** IANA username format — matches the profiles_username_format CHECK constraint. */
export const usernameSchema = z.string().regex(/^[a-zA-Z0-9_]{3,30}$/, {
  message: 'Usernames are 3-30 characters: letters, numbers, and underscores only.',
});

export const notificationPreferencesSchema = z.object({
  email: z.boolean(),
  productUpdates: z.boolean(),
  weeklyDigest: z.boolean(),
});

export const onboardingSchema = z.object({
  goal: z.string().max(500).optional(),
  fullName: z.string().min(1).max(200).optional(),
  username: usernameSchema.optional(),
  avatarUrl: z.string().url().optional(),
  dateOfBirth: z.string().date().optional(),
  phoneNumber: z.string().max(30).optional(),
  role: selfServiceRoleSchema.optional(),
  universityName: z.string().max(200).optional(),
  rollNumber: z.string().max(100).optional(),
  department: z.string().max(200).optional(),
  yearLevel: yearLevelSchema.optional(),
  enrolledCourses: z.array(z.string().min(1).max(100)).max(30).optional(),
  subjects: z.array(z.string().min(1).max(100)).max(20).optional(),
  alternateEmail: z.string().email().max(320).optional(),
  timeZone: z.string().max(100).optional(),
  languagePreference: z.string().max(50).optional(),
  notificationPreferences: notificationPreferencesSchema.optional(),
  diagnosticAnswers: z
    .array(z.object({ questionId: z.string(), answer: z.string().max(2000) }))
    .max(5)
    .optional(),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

/**
 * Magic-link sign-in — kept for the extension's OTP-code flow (a browser
 * extension has no URL bar to land a redirect on, so email+password isn't
 * a natural fit there). The web app's own /login now uses password auth
 * instead; see signUpSchema / signInSchema below.
 */
export const magicLinkSchema = z.object({
  email: z.string().email().max(320),
  username: usernameSchema,
});
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

/** Supabase's own minimum; matches what GoTrue will reject below anyway. */
export const passwordSchema = z.string().min(8).max(72);

/**
 * Web sign-up: email + username + password. Supabase creates the account
 * and emails a confirmation link — the one-time email step still exists,
 * it just verifies the account rather than being how every sign-in works.
 */
export const signUpSchema = z.object({
  email: z.string().email().max(320),
  username: usernameSchema,
  password: passwordSchema,
});
export type SignUpInput = z.infer<typeof signUpSchema>;

/** Returning-user sign-in: no email round-trip, no username field. */
export const signInSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(72),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const resetPasswordRequestSchema = z.object({
  email: z.string().email().max(320),
});
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;

export const updatePasswordSchema = z.object({
  password: passwordSchema,
});
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

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

export const dashboardWidgetSchema = z.enum(DASHBOARD_WIDGETS);
export const accentColorSchema = z.enum(ACCENT_COLORS);
export const themeModeSchema = z.enum(THEME_MODES);
export const refreshIntervalSchema = z.union([
  z.literal(REFRESH_INTERVALS[0]),
  z.literal(REFRESH_INTERVALS[1]),
  z.literal(REFRESH_INTERVALS[2]),
  z.literal(REFRESH_INTERVALS[3]),
]);

export const dashboardPreferencesSchema = z.object({
  theme: themeModeSchema,
  accentColor: accentColorSchema,
  hiddenWidgets: z.array(dashboardWidgetSchema).max(DASHBOARD_WIDGETS.length),
  widgetOrder: z.array(dashboardWidgetSchema).max(DASHBOARD_WIDGETS.length),
  proBannerDismissed: z.boolean(),
  knowledgeMapSubjects: z.array(z.string().min(1).max(100)).max(3),
  refreshIntervalSeconds: refreshIntervalSchema,
});
export type DashboardPreferencesInput = z.infer<typeof dashboardPreferencesSchema>;

export const nicknameSchema = z.string().min(1).max(50);

/** Ghost Memory vector search over the student's own past mistakes. */
export const ghostMemoryQuerySchema = z.object({
  query: z.string().min(1).max(2000),
  limit: z.number().int().min(1).max(50).default(10),
  /** Cosine similarity floor, 0–1. */
  threshold: z.number().min(0).max(1).default(0.7),
});
export type GhostMemoryQueryInput = z.infer<typeof ghostMemoryQuerySchema>;
