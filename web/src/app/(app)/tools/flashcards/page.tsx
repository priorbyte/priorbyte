import type { Metadata } from 'next';
import { isGeminiConfigured } from '@/lib/gemini';
import { requireProfile } from '@/lib/auth';
import { FlashcardsForm } from './form';

export const metadata: Metadata = { title: 'Flashcard Generator' };

export default async function FlashcardsPage() {
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
        <h1 className="mt-2 text-4xl">Flashcard Generator</h1>
        <p className="mt-2 max-w-2xl text-silver">
          Paste study material, get flashcards you can flip through.
        </p>
      </div>
      <FlashcardsForm />
    </div>
  );
}
