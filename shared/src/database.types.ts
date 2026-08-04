/**
 * Typed contract for the Supabase schema.
 *
 * HAND-WRITTEN placeholder that mirrors backend/supabase/migrations. Once the
 * project is linked, replace it wholesale:
 *
 *   pnpm --filter @priorbyte/backend types:gen
 *
 * Until then, treat this file as authoritative and keep it in step with any
 * new migration.
 */

import type {
  ChatSharingLevel,
  InoculationFormat,
  LearningEventType,
  NotificationPreferences,
  PredictionOutcome,
  SubscriptionTier,
  TimelineStage,
  UserRole,
  YearLevel,
} from './constants';

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/** Columns the database fills in for you. */
type Generated = 'id' | 'created_at' | 'updated_at';

/**
 * `Relationships` is required: supabase-js resolves table types to `never`
 * without it, which silently turns every query into an untyped dead end.
 */
type TableShape<Row, RequiredOnInsert extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, RequiredOnInsert> & Partial<Omit<Row, RequiredOnInsert>>;
  Update: Partial<Row>;
  Relationships: [];
}

export type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  subscription_tier: SubscriptionTier;
  goal: string | null;
  subjects: string[];
  onboarding_completed_at: string | null;
  username: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  university_name: string | null;
  roll_number: string | null;
  department: string | null;
  year_level: YearLevel | null;
  enrolled_courses: string[];
  alternate_email: string | null;
  time_zone: string;
  language_preference: string;
  notification_preferences: NotificationPreferences;
  created_at: string;
  updated_at: string;
}

export type CourseRow = {
  id: string;
  code: string;
  title: string;
  institution: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CourseEnrollmentRow = {
  course_id: string;
  user_id: string;
  enrolled_at: string;
}

export type KnowledgeGraphRow = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  summary: string | null;
  misconceptions: string[];
  created_at: string;
  updated_at: string;
}

export type KnowledgeGraphEdgeRow = {
  topic_id: string;
  prerequisite_id: string;
  strength: number;
}

export type LearningEventRow = {
  id: string;
  user_id: string;
  type: LearningEventType;
  content: string;
  topic_id: string | null;
  course_id: string | null;
  source: string | null;
  /** pgvector column — serialised as a string over PostgREST. */
  embedding: string | null;
  occurred_at: string;
  created_at: string;
}

export type TopicMasteryRow = {
  id: string;
  user_id: string;
  topic_id: string;
  stage: TimelineStage;
  confidence: number;
  first_seen_at: string;
  updated_at: string;
}

export type TimelineEntryRow = {
  id: string;
  user_id: string;
  topic_id: string;
  stage: TimelineStage;
  summary: string;
  learning_event_id: string | null;
  occurred_at: string;
}

export type VulnerabilityModelRow = {
  id: string;
  user_id: string;
  patterns: Json;
  confidence: number;
  events_analyzed: number;
  last_computed_at: string;
  created_at: string;
}

export type PredictedErrorRow = {
  id: string;
  user_id: string;
  topic_id: string;
  prediction: string;
  pattern_key: string | null;
  confidence: number;
  inoculation_format: InoculationFormat | null;
  inoculation_content: string | null;
  inoculation_delivered_at: string | null;
  inoculation_acknowledged_at: string | null;
  outcome: PredictionOutcome;
  predicted_at: string;
  resolved_at: string | null;
}

export type GhostForkRow = {
  id: string;
  user_id: string;
  topic_id: string;
  predicted_error_id: string | null;
  original_path: Json;
  protected_path: Json;
  stages_saved: number;
  created_at: string;
}

export type ChatConversationRow = {
  id: string;
  user_id: string;
  title: string | null;
  course_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ChatHistoryRow = {
  id: string;
  user_id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  course_id: string | null;
  context_event_ids: string[];
  token_count: number | null;
  created_at: string;
}

export type ChatSharingConsentRow = {
  id: string;
  user_id: string;
  course_id: string;
  level: ChatSharingLevel;
  shared_conversation_ids: string[];
  updated_at: string;
}

export type AllowedEmailDomainRow = {
  domain: string;
  added_by: string | null;
  created_at: string;
};

export type AiUsageRow = {
  id: string;
  user_id: string;
  feature: string;
  input_tokens: number;
  output_tokens: number;
  model: string | null;
  created_at: string;
}

/** Row shape returned by the `match_learning_events` RPC. */
export type MatchedLearningEvent = {
  id: string;
  type: LearningEventType;
  content: string;
  topic_id: string | null;
  source: string | null;
  occurred_at: string;
  similarity: number;
}

export type Database = {
  public: {
    Tables: {
      profiles: TableShape<ProfileRow, 'id' | 'email'>;
      courses: TableShape<CourseRow, 'code' | 'title'>;
      course_enrollments: TableShape<CourseEnrollmentRow, 'course_id' | 'user_id'>;
      knowledge_graph: TableShape<KnowledgeGraphRow, 'slug' | 'title' | 'subject'>;
      knowledge_graph_edges: TableShape<KnowledgeGraphEdgeRow, 'topic_id' | 'prerequisite_id'>;
      learning_events: TableShape<LearningEventRow, 'user_id' | 'type' | 'content'>;
      topic_mastery: TableShape<TopicMasteryRow, 'user_id' | 'topic_id'>;
      timeline_entries: TableShape<TimelineEntryRow, 'user_id' | 'topic_id' | 'stage' | 'summary'>;
      vulnerability_model: TableShape<VulnerabilityModelRow, 'user_id'>;
      predicted_errors: TableShape<PredictedErrorRow, 'user_id' | 'topic_id' | 'prediction'>;
      ghost_forks: TableShape<GhostForkRow, 'user_id' | 'topic_id'>;
      chat_conversations: TableShape<ChatConversationRow, 'user_id'>;
      chat_history: TableShape<ChatHistoryRow, 'user_id' | 'conversation_id' | 'role' | 'content'>;
      chat_sharing_consent: TableShape<ChatSharingConsentRow, 'user_id' | 'course_id' | 'level'>;
      ai_usage: TableShape<AiUsageRow, 'user_id' | 'feature'>;
      allowed_email_domains: TableShape<AllowedEmailDomainRow, 'domain'>;
    };
    Views: { [_ in never]: never };
    Functions: {
      match_learning_events: {
        Args: {
          query_embedding: string;
          match_threshold?: number;
          match_count?: number;
          filter_types?: LearningEventType[] | null;
        };
        Returns: MatchedLearningEvent[];
      };
      advance_topic_stage: {
        Args: {
          target_topic_id: string;
          new_stage: TimelineStage;
          entry_summary: string;
          new_confidence?: number | null;
          source_event_id?: string | null;
        };
        Returns: TopicMasteryRow;
      };
      ai_queries_remaining: {
        Args: Record<PropertyKey, never>;
        Returns: number | null;
      };
      request_magic_link_allowed: {
        Args: {
          target_email: string;
          max_attempts?: number;
          window_minutes?: number;
        };
        Returns: boolean;
      };
      is_email_domain_allowed: {
        Args: { candidate_email: string };
        Returns: boolean;
      };
      is_username_available: {
        Args: { candidate: string };
        Returns: boolean;
      };
      topic_prerequisites: {
        Args: { target_topic_id: string; max_depth?: number };
        Returns: { id: string; slug: string; title: string; depth: number }[];
      };
    };
    Enums: {
      user_role: UserRole;
      subscription_tier: SubscriptionTier;
      timeline_stage: TimelineStage;
      chat_sharing_level: ChatSharingLevel;
      learning_event_type: LearningEventType;
      inoculation_format: InoculationFormat;
      prediction_outcome: PredictionOutcome;
      year_level: YearLevel;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

/** Convenience aliases. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

/** `Generated` is exported so migrations-aware code can reason about defaults. */
export type GeneratedColumn = Generated;
