import { NextResponse, type NextRequest } from 'next/server';
import { generateTextFromDocument, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { getMobileUser } from '@/lib/mobile-auth';
import { uploadToR2 } from '@/lib/r2';

export const dynamic = 'force-dynamic';

// Base64 inflates size by ~33%; keep the underlying file well under the
// 10MB default body limit for Route Handlers.
const MAX_BASE64_LENGTH = 8_000_000;

const SYSTEM_PROMPT = `You read an uploaded PDF (lecture slides, a textbook chapter, or
handout) and produce a study-ready breakdown: (1) a short overview of what the document
covers, (2) key points grouped under headings matching the document's own structure where
possible, (3) any formulas, definitions, or dates verbatim. If the PDF is unreadable or
mostly images with no extractable meaning, say so plainly rather than inventing content.`;

export async function POST(request: NextRequest) {
  const { supabase, user } = await getMobileUser(request);
  if (!supabase || !user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isGeminiConfigured()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const base64Data = typeof body?.fileData === 'string' ? body.fileData : '';
  const fileName = typeof body?.fileName === 'string' ? body.fileName : 'document.pdf';
  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : 'application/pdf';

  if (!base64Data) return NextResponse.json({ error: 'Choose a PDF first.' }, { status: 400 });
  if (base64Data.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: 'That PDF is too large (max ~6MB).' }, { status: 400 });
  }
  if (mimeType !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 });
  }

  const quota = await checkQuota(supabase);
  if (!quota.allowed) return NextResponse.json({ error: quota.message }, { status: 429 });

  const summary = await generateTextFromDocument(
    SYSTEM_PROMPT,
    'Summarize this document for study review.',
    base64Data,
    mimeType,
  );
  if (!summary) return NextResponse.json({ error: 'Could not read that PDF just now. Try again.' }, { status: 502 });

  await logAiUsage(supabase, user.id, 'pdf_reader');

  const r2Key = await uploadToR2(
    `pdf-reader/${user.id}/${Date.now()}-${fileName}`,
    Buffer.from(base64Data, 'base64'),
    mimeType,
  );

  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'reading',
    content: `[${fileName}]${r2Key ? ` (stored: ${r2Key})` : ''}\n\n${summary}`,
    source: 'tool_pdf_reader',
  });

  return NextResponse.json({ summary, fileName });
}
