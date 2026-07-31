# Priorbyte

**Predict. Protect. Perfect.**

The first AI that predicts your future learning mistakes — and stops them before
they happen. Not a tutor, not an LMS, not a note app: a **learning immune
system**.

Core loop: **Capture → Embed → Model vulnerability → Predict error → Inoculate →
Record outcome (Ghost Fork)**.

## Workspace

| Package | Path | What it is |
| --- | --- | --- |
| `@priorbyte/web` | `web/` | Next.js 14 App Router + Tailwind — student/staff web app |
| `@priorbyte/extension` | `extension/` | Plasmo Chrome extension — passive capture (step 4) |
| `@priorbyte/backend` | `backend/` | Supabase config, migrations, RLS, Edge Functions (step 2) |
| `@priorbyte/ai` | `ai/` | Claude prompt chains and embedding scripts |
| `@priorbyte/shared` | `shared/` | Shared TypeScript types, constants, zod schemas |

`mobile/` (React Native / Expo) arrives in Phase 5 and is not created yet.

## Getting started

Requires Node 20+ and pnpm 9 (`corepack enable pnpm`).

```bash
pnpm install
```

```bash
cp .env.example web/.env.local
```

```bash
pnpm dev
```

The web app runs on http://localhost:3000.

## Scripts

| Command | Effect |
| --- | --- |
| `pnpm dev` | Run every package's dev task via Turborepo |
| `pnpm build` | Production build |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |
| `pnpm lint` | ESLint, zero warnings tolerated |
| `pnpm format` | Prettier write |

## Conventions

- **TypeScript only**, `strict` on, no plain JS.
- Brand colors and fonts live in `shared/src/brand.ts` — the Tailwind config
  imports from there, so never hardcode a hex in a component.
- Anything crossing a trust boundary is validated with a zod schema from
  `shared/src/schemas.ts`.
- **RLS is enabled on every Supabase table from its first migration.** Student
  privacy is a hard constraint: staff get aggregated, anonymized insight by
  default, and raw chat access only through an explicit, revocable, per-course
  `chat_sharing_consent` opt-in enforced in Postgres.

## Design reference

`design/` mirrors the Stitch mockup export (Tailwind HTML + screenshots) for
each screen. It is gitignored — treat it as read-only visual reference.

## Build phases

1. **Phase 1 (current)** — auth, onboarding, extension capture, Ghost Memory,
   Ghost Timeline, basic AI tutor, learning tools
2. Phase 2 — Psychic Lattice, Error Oracle, Inoculation Engine, Ghost Fork
3. Phase 3 — Ghost DNA, Knowledge Graph, Ghost Score/Predictor/Mentor, coding features
4. Phase 4 — social, gamification, faculty dashboard, Ghost Portfolio
5. Phase 5 — mobile, integrations, enterprise, voice, vision, XR
