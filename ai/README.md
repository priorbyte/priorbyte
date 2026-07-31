# @priorbyte/ai

Prompt chains, embedding scripts, and Claude prompt templates for the pipeline
in Section 9 of the blueprint:

| Stage | Where it runs | Phase |
| --- | --- | --- |
| Capture | `/extension` → Supabase | 1 |
| Embed (Voyage AI) | Supabase Edge Function | 1 |
| Ghost Memory (vector search) | `/web` + Edge Function | 1 |
| Psychic Lattice (daily cron) | Edge Function | 2 |
| Error Oracle | Edge Function + Claude | 2 |
| Inoculation Engine | Edge Function + Claude | 2 |
| Ghost Fork | Edge Function | 2 |

`prompts/` holds versioned prompt templates as `.md` files so prompt changes are
reviewable in diffs.
