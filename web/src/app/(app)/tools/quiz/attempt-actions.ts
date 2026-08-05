'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Records each answered question as its own learning_event — this is the
 * actual signal the blueprint's capture pipeline is meant to run on, not
 * just the quiz-taking UI's internal state. A wrong answer captures the
 * question, what was picked, and why it's wrong, so it's real material for
 * the (future) vulnerability model.
 */
export async function recordQuizAttempt(
  question: string,
  selectedOption: string,
  correctOption: string,
  isCorrect: boolean,
  explanation: string,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const content = isCorrect
    ? `Q: ${question}\nAnswered correctly: ${selectedOption}`
    : `Q: ${question}\nAnswered: ${selectedOption} (incorrect)\nCorrect answer: ${correctOption}\nWhy: ${explanation}`;

  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'quiz_attempt',
    content,
    source: 'tool_quiz',
  });
}
