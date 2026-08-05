'use server';

import { generateTextFromDocument, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { createClient } from '@/lib/supabase/server';

export interface PdfReaderState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
  summary?: string;
  fileName?: string;
}

// Base64 inflates size by ~33%; keep the underlying file well under the
// 10MB serverActionsBodySizeLimit set in next.config.mjs.
const MAX_BASE64_LENGTH = 8_000_000;

const SYSTEM_PROMPT = `You read an uploaded PDF (lecture slides, a textbook chapter, or
handout) and produce a study-ready breakdown: (1) a short overview of what the document
covers, (2) key points grouped under headings matching the document's own structure where
possible, (3) any formulas, definitions, or dates verbatim. If the PDF is unreadable or
mostly images with no extractable meaning, say so plainly rather than inventing content.`;

export async function readPdf(_prev: PdfReaderState, formData: FormData): Promise<PdfReaderState> {
  const base64Data = String(formData.get('fileData') ?? '');
  const fileName = String(formData.get('fileName') ?? 'document.pdf');
  const mimeType = String(formData.get('mimeType') ?? 'application/pdf');

  if (!base64Data) return { status: 'error', message: 'Choose a PDF first.' };
  if (base64Data.length > MAX_BASE64_LENGTH) {
    return { status: 'error', message: 'That PDF is too large (max ~6MB).' };
  }
  if (mimeType !== 'application/pdf') {
    return { status: 'error', message: 'Only PDF files are supported.' };
  }

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

  const summary = await generateTextFromDocument(
    SYSTEM_PROMPT,
    'Summarize this document for study review.',
    base64Data,
    mimeType,
  );
  if (!summary) {
    return { status: 'error', message: 'Could not read that PDF just now. Try again.' };
  }

  await logAiUsage(supabase, user.id, 'pdf_reader');

  // The summary, not the raw PDF binary, is what's worth capturing as
  // signal — it's real text Ghost Memory can actually search.
  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'reading',
    content: `[${fileName}]\n\n${summary}`,
    source: 'tool_pdf_reader',
  });

  return { status: 'ok', summary, fileName };
}
