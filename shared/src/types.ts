/**
 * Domain types mirroring the Supabase schema (Section 6 of the blueprint).
 * These are hand-written and authoritative for the app layer; generated
 * `database.types.ts` will be added in step 2 and reconciled against these.
 */

import type {
  ChatSharingLevel,
  InoculationFormat,
  LearningEventType,
  PredictionOutcome,
  SubscriptionTier,
  TimelineStage,
  UserRole,
} from './constants';

export type UUID = string;
/** ISO-8601 timestamp string. */
export type Timestamp = string;

export interface UserProfile {
  id: UUID;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  /** Free-text goal captured during onboarding; skippable. */
  goal: string | null;
  onboardingCompletedAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface LearningEvent {
  id: UUID;
  userId: UUID;
  type: LearningEventType;
  /** Raw captured text (note body, question asked, code submitted…). */
  content: string;
  /** Topic slug from `knowledge_graph`, when resolvable. */
  topicId: UUID | null;
  /** Where it was captured: URL, course id, or extension source label. */
  source: string | null;
  /** Voyage AI embedding. Omitted from most reads — it is large. */
  embedding?: number[] | null;
  occurredAt: Timestamp;
  createdAt: Timestamp;
}

/** Per-user cognitive pattern, rewritten by the daily Psychic Lattice cron. */
export interface VulnerabilityModel {
  id: UUID;
  userId: UUID;
  /** Weighted misconception signatures keyed by topic or concept slug. */
  patterns: Record<string, VulnerabilityPattern>;
  /** 0–1 confidence that the model has enough signal to predict. */
  confidence: number;
  lastComputedAt: Timestamp;
}

export interface VulnerabilityPattern {
  label: string;
  /** 0–1 — how likely this pattern is to resurface. */
  weight: number;
  /** Number of observed corrections backing this pattern. */
  evidenceCount: number;
  relatedTopicIds: UUID[];
}

export interface PredictedError {
  id: UUID;
  userId: UUID;
  topicId: UUID;
  /** What Claude thinks the student will get wrong, in plain language. */
  prediction: string;
  /** 0–1 model confidence. */
  confidence: number;
  inoculation: Inoculation | null;
  outcome: PredictionOutcome;
  predictedAt: Timestamp;
  resolvedAt: Timestamp | null;
}

export interface Inoculation {
  format: InoculationFormat;
  content: string;
  deliveredAt: Timestamp | null;
  acknowledgedAt: Timestamp | null;
}

/** Shared across all users — not student-owned data. */
export interface KnowledgeGraphNode {
  id: UUID;
  slug: string;
  title: string;
  subject: string;
  /** Topic ids that should be understood first. */
  prerequisiteIds: UUID[];
  /** Known misconceptions attached to this topic. */
  misconceptions: string[];
}

/** Original (error) path vs. protected path for one topic. */
export interface GhostFork {
  id: UUID;
  userId: UUID;
  topicId: UUID;
  predictedErrorId: UUID | null;
  /** What would have happened without inoculation. */
  originalPath: GhostForkStep[];
  /** What actually happened after inoculation. */
  protectedPath: GhostForkStep[];
  createdAt: Timestamp;
}

export interface GhostForkStep {
  stage: TimelineStage;
  summary: string;
  occurredAt: Timestamp | null;
}

export interface ChatMessage {
  id: UUID;
  userId: UUID;
  conversationId: UUID;
  role: 'user' | 'assistant';
  content: string;
  /** Course this conversation belongs to, if any — drives sharing consent. */
  courseId: UUID | null;
  createdAt: Timestamp;
}

/**
 * Per-course, per-student opt-in for staff chat visibility.
 * Absence of a row means `none`. Never default to anything else.
 */
export interface ChatSharingConsent {
  id: UUID;
  userId: UUID;
  courseId: UUID;
  level: ChatSharingLevel;
  /** Conversation ids shared when level is `selected`. */
  sharedConversationIds: UUID[];
  updatedAt: Timestamp;
}
