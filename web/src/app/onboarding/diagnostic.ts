/**
 * Shared between the client wizard (renders the questions) and the server
 * action (needs the question text to write a meaningful learning_events
 * row) — a plain data module so neither side needs a 'use client'/'use
 * server' boundary crossing just to read five strings.
 */
export const DIAGNOSTIC = [
  { id: 'q1', question: 'When you get a question wrong, what usually went wrong first?' },
  { id: 'q2', question: 'Which subject do you re-read most often without it sticking?' },
  { id: 'q3', question: 'Do you prefer worked examples or first principles?' },
  { id: 'q4', question: 'What is the last thing you understood, then forgot?' },
  { id: 'q5', question: 'When are you most likely to be studying?' },
] as const;
