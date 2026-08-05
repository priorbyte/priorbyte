'use server';

import { generateText, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { createClient } from '@/lib/supabase/server';

export interface FormulaState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
  explanation?: string;
}

const MAX_INPUT_LENGTH = 2000;

const SYSTEM_PROMPT = `You explain a single formula or equation a student pastes in. Structure
your answer as: (1) what each variable/symbol means, (2) what the formula computes and when
it applies, (3) a fully worked numeric example, (4) the single most common mistake students
make when using it. Be precise about units where relevant. If the input isn't a formula,
say so plainly rather than guessing.`;

export async function explainFormula(
  _prev: FormulaState,
  formData: FormData,
): Promise<FormulaState> {
  const content = String(formData.get('content') ?? '').trim();
  if (!content) return { status: 'error', message: 'Paste a formula first.' };
  if (content.length > MAX_INPUT_LENGTH) return { status: 'error', message: 'Too long.' };

  if (!isGeminiConfigured()) {
    return { status: 'error', message: 'This tool is not configured yet on this deployment.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Not signed in.' };

  const quota = await checkQuota(supabase);
  if (!quota.allowed) {
    return { status: 'error', message: quota.message ?? 'Quota check failed.' };
  }

  const explanation = await generateText(SYSTEM_PROMPT, content);
  if (!explanation) {
    return { status: 'error', message: 'Could not explain that just now. Try again.' };
  }

  await logAiUsage(supabase, user.id, 'formula_explainer');

  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'question',
    content,
    source: 'tool_formula_explainer',
  });

  return { status: 'ok', explanation };
}
