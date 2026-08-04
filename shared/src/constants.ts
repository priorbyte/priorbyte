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

/** Academic year/semester level, self-reported during onboarding. */
export const YEAR_LEVELS = ['year_1', 'year_2', 'year_3', 'year_4', 'graduate', 'other'] as const;
export type YearLevel = (typeof YEAR_LEVELS)[number];

export const YEAR_LEVEL_LABELS: Record<YearLevel, string> = {
  year_1: '1st Year',
  year_2: '2nd Year',
  year_3: '3rd Year',
  year_4: '4th Year',
  graduate: 'Graduate',
  other: 'Other',
};

/**
 * Priorbyte is "the operating system for every student's mind," not a STEM
 * tutor — the list has to reflect that, with an escape hatch for anything
 * still missing. Shared between onboarding and the Settings profile editor
 * so the two never drift apart.
 */
export const SUBJECT_GROUPS: Record<string, readonly string[]> = {
  'Math & Statistics': ['Calculus', 'Linear Algebra', 'Statistics', 'Discrete Math'],
  'Computer Science': [
    'Computer Science',
    'Data Structures',
    'Algorithms',
    'Machine Learning',
    'Web Development',
    'Databases',
  ],
  'Natural Sciences': ['Physics', 'Chemistry', 'Biology', 'Earth Science'],
  Engineering: ['Electronics', 'Mechanical Engineering', 'Civil Engineering'],
  'Business & Economics': ['Economics', 'Accounting', 'Finance', 'Marketing'],
  'Humanities & Social Sciences': [
    'History',
    'Philosophy',
    'Psychology',
    'Political Science',
    'Sociology',
  ],
  'Languages & Writing': ['English & Literature', 'Foreign Languages', 'Writing & Composition'],
  'Health & Medicine': ['Biology (Pre-Med)', 'Anatomy & Physiology', 'Nursing'],
  Law: ['Law & Legal Studies'],
} as const;

/**
 * Roles a student may declare for themselves at signup. `admin` is
 * deliberately excluded — it is granted only by an existing admin, never
 * self-selected, and role is frozen entirely after the first onboarding
 * completes (see guard_profile_privileges in the schema).
 */
export const SELF_SERVICE_ROLES = ['student', 'faculty'] as const;
export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

export interface NotificationPreferences {
  email: boolean;
  productUpdates: boolean;
  weeklyDigest: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  productUpdates: true,
  weeklyDigest: true,
};

/** Dashboard widgets that actually exist and can be shown, hidden, or reordered. */
export const DASHBOARD_WIDGETS = [
  'streak',
  'weekly_snapshot',
  'weak_strong_topics',
  'knowledge_map',
  'mini_timeline',
  'integration_status',
] as const;
export type DashboardWidget = (typeof DASHBOARD_WIDGETS)[number];

/** Personal accent color. `teal`/`amber` elsewhere in the UI keep their own
 * fixed semantic meaning (success/warning) regardless of this choice. */
export const ACCENT_COLORS = ['cyan', 'teal', 'purple', 'amber'] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

/** RGB triplets (space-separated, matching the CSS var convention in globals.css). */
export const ACCENT_COLOR_VALUES: Record<AccentColor, string> = {
  cyan: '0 229 255',
  teal: '0 191 165',
  purple: '168 85 247',
  amber: '255 171 0',
};

export const THEME_MODES = ['dark', 'light'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** Seconds between auto-refreshes; 0 means off. */
export const REFRESH_INTERVALS = [0, 30, 60, 300] as const;
export type RefreshInterval = (typeof REFRESH_INTERVALS)[number];

export interface DashboardPreferences {
  theme: ThemeMode;
  accentColor: AccentColor;
  hiddenWidgets: DashboardWidget[];
  widgetOrder: DashboardWidget[];
  proBannerDismissed: boolean;
  /** Empty = auto-pick the top 3 by tracked-topic count. */
  knowledgeMapSubjects: string[];
  refreshIntervalSeconds: RefreshInterval;
}

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  theme: 'dark',
  accentColor: 'cyan',
  hiddenWidgets: [],
  widgetOrder: [...DASHBOARD_WIDGETS],
  proBannerDismissed: false,
  knowledgeMapSubjects: [],
  refreshIntervalSeconds: 0,
};

/**
 * Fills in defaults for anything missing from stored preferences (a fresh
 * account, or a shape from before a new preference existed) and drops any
 * widget id that no longer exists — the jsonb column is schemaless, so this
 * boundary is what keeps a stale value from ever reaching a component.
 */
export function mergeDashboardPreferences(
  stored: Partial<DashboardPreferences> | null | undefined,
): DashboardPreferences {
  const knownWidgets = new Set<string>(DASHBOARD_WIDGETS);
  const widgetOrder = (stored?.widgetOrder ?? DEFAULT_DASHBOARD_PREFERENCES.widgetOrder).filter(
    (w): w is DashboardWidget => knownWidgets.has(w),
  );
  for (const w of DASHBOARD_WIDGETS) {
    if (!widgetOrder.includes(w)) widgetOrder.push(w);
  }

  return {
    theme: stored?.theme ?? DEFAULT_DASHBOARD_PREFERENCES.theme,
    accentColor: stored?.accentColor ?? DEFAULT_DASHBOARD_PREFERENCES.accentColor,
    hiddenWidgets: (stored?.hiddenWidgets ?? []).filter((w): w is DashboardWidget =>
      knownWidgets.has(w),
    ),
    widgetOrder,
    proBannerDismissed: stored?.proBannerDismissed ?? false,
    knowledgeMapSubjects: stored?.knowledgeMapSubjects ?? [],
    refreshIntervalSeconds: stored?.refreshIntervalSeconds ?? 0,
  };
}

/**
 * Single source of truth for the onboarding diagnostic questions, shared
 * between the wizard (renders them) and the server action (labels the
 * learning_events it writes from the answers) so the two can never drift.
 */
export const ONBOARDING_DIAGNOSTIC_QUESTIONS = [
  { id: 'q1', question: 'When you get a question wrong, what usually went wrong first?' },
  { id: 'q2', question: 'Which subject do you re-read most often without it sticking?' },
  { id: 'q3', question: 'Do you prefer worked examples or first principles?' },
  { id: 'q4', question: 'What is the last thing you understood, then forgot?' },
  { id: 'q5', question: 'When are you most likely to be studying?' },
] as const;
