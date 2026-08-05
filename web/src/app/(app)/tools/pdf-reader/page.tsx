import type { Metadata } from 'next';
import { isGeminiConfigured } from '@/lib/gemini';
import { requireProfile } from '@/lib/auth';
import { PdfReaderForm } from './form';

export const metadata: Metadata = { title: 'PDF Reader' };

export default async function PdfReaderPage() {
  await requireProfile();

  if (!isGeminiConfigured()) {
    return (
      <div className="pb-panel max-w-2xl border-amber/40">
        <p className="pb-label text-amber">Not configured</p>
        <p className="mt-2 text-sm text-silver">
          Set <code className="font-mono text-cyan">GEMINI_API_KEY</code> to enable this tool.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="pb-label">Learning Tools</p>
        <h1 className="mt-2 text-4xl">PDF Reader</h1>
        <p className="mt-2 max-w-2xl text-silver">
          Upload a PDF — slides, a chapter, a handout — and get a study-ready breakdown.
        </p>
      </div>
      <PdfReaderForm />
    </div>
  );
}
