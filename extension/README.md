# @priorbyte/extension

Plasmo Chrome extension for passive learning-event capture.

Scaffolded in **step 4** of Phase 1. It will post `CaptureLearningEventInput`
(see `@priorbyte/shared/schemas`) to Supabase using the anon key plus the
signed-in user's session — never the service-role key.
