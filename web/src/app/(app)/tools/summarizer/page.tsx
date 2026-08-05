import type { Metadata } from 'next';
import { isGeminiConfigured } from '@/lib/gemini';
import { requireProfile } from '@/lib/auth';
import { SummarizerForm } from './form';

export const metadata: Metadata = { title: 'Notes Summarizer' };

export default async function SummarizerPage() {
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
        <h1 className="mt-2 text-4xl">Notes Summarizer</h1>
        <p className="mt-2 max-w-2xl text-silver">
          Paste raw notes, get a structured summary for fast review.
        </p>
      </div>
      <SummarizerForm />
    </div>
  );
}
