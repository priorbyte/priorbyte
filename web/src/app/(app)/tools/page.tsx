import Link from 'next/link';
import type { Metadata } from 'next';
import { requireProfile } from '@/lib/auth';

export const metadata: Metadata = { title: 'Learning Tools' };

const TOOLS = [
  { title: 'Notes Summarizer', href: '/tools/summarizer', available: true },
  { title: 'Flashcard Generator', href: '/tools/flashcards', available: true },
  { title: 'Quiz / MCQ Generator', href: '/tools/quiz', available: true },
  { title: 'Formula Explainer', href: '/tools/formula', available: true },
  { title: 'Concept Simplifier', href: '/tools/simplifier', available: true },
  { title: 'Mind Map Generator', href: '/tools/mindmap', available: true },
  { title: 'PDF Reader', href: null, available: false },
  { title: 'Lecture Summarizer', href: null, available: false },
] as const;

export default async function ToolsPage() {
  await requireProfile();

  return (
    <div className="space-y-6">
      <div>
        <p className="pb-label">Learning Tools</p>
        <h1 className="mt-2 text-4xl">Everything besides the tutor</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) =>
          tool.available && tool.href ? (
            <Link
              key={tool.title}
              href={tool.href}
              className="pb-panel block transition hover:border-cyan/30"
            >
              <h2 className="text-xl text-white">{tool.title}</h2>
            </Link>
          ) : (
            <div key={tool.title} className="pb-panel opacity-50">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl text-white">{tool.title}</h2>
                <span className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-muted">
                  Coming soon
                </span>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
