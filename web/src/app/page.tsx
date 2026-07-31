import Link from 'next/link';
import { BRAND } from '@priorbyte/shared/brand';
import { ShieldLogo } from '@/components/shield-logo';

const LOOP = [
  { step: 'Capture', detail: 'Learning events collected passively while you work.' },
  { step: 'Model', detail: 'A cognitive vulnerability profile, rebuilt daily.' },
  { step: 'Predict', detail: 'The errors you are about to make, named in advance.' },
  { step: 'Inoculate', detail: 'Micro-content that stops the mistake from forming.' },
] as const;

export default function HomePage() {
  return (
    <main className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-blueprint bg-blueprint-grid [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
        <div className="flex items-center gap-3">
          <ShieldLogo className="h-8 w-8 text-cyan" />
          <span className="font-display text-lg font-bold text-white">{BRAND.name}</span>
        </div>
        <Link
          href="/login"
          className="rounded-lg border border-cyan/40 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-cyan transition hover:bg-cyan/10 hover:shadow-glow"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-center">
        <p className="pb-label">{BRAND.tagline}</p>
        <h1 className="mt-6 text-balance text-4xl leading-tight sm:text-6xl">
          The first AI that predicts your future learning mistakes
          <span className="text-cyan"> — and stops them before they happen.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-silver">
          Not a tutor. Not an LMS. A learning immune system that replaces the report card with a
          lifelong cognitive twin.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow"
          >
            Get early access
          </Link>
          <Link
            href="#loop"
            className="rounded-lg border border-line px-6 py-3 font-display text-white transition hover:border-cyan/40"
          >
            How it works
          </Link>
        </div>
      </section>

      <section id="loop" className="mx-auto max-w-6xl px-6 pb-28">
        <h2 className="pb-label text-center">The core loop</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LOOP.map(({ step, detail }, i) => (
            <div key={step} className="pb-panel transition hover:border-cyan/30">
              <span className="font-mono text-xs text-cyan">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-3 text-xl">{step}</h3>
              <p className="mt-2 text-sm text-muted">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line px-6 py-8 text-center font-mono text-xs text-muted">
        © {new Date().getFullYear()} {BRAND.name}
      </footer>
    </main>
  );
}
