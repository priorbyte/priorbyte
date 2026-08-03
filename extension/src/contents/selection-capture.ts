import type { PlasmoCSConfig } from 'plasmo';
import { sendCaptureMessage } from '~lib/messages';

/**
 * Passive capture, v1: when a student selects a meaningful chunk of text on
 * any page, that's a signal they're engaging with it — a note, a definition,
 * a problem statement. No page content is read otherwise; nothing is sent
 * without an explicit selection gesture.
 */
export const config: PlasmoCSConfig = {
  matches: ['https://*/*'],
  all_frames: false,
};

const MIN_LENGTH = 20;
const MAX_LENGTH = 20_000;
const DEBOUNCE_MS = 800;

let debounceHandle: ReturnType<typeof setTimeout> | undefined;

function handleSelection() {
  const text = window.getSelection()?.toString().trim() ?? '';
  if (text.length < MIN_LENGTH) return;

  sendCaptureMessage({
    type: 'note',
    content: text.slice(0, MAX_LENGTH),
    source: window.location.href,
    occurredAt: new Date().toISOString(),
  });
}

document.addEventListener('mouseup', () => {
  clearTimeout(debounceHandle);
  debounceHandle = setTimeout(handleSelection, DEBOUNCE_MS);
});

document.addEventListener('keyup', (event) => {
  // Keyboard-driven selection (shift+arrow, ctrl+a) fires no mouseup.
  if (!event.shiftKey && event.key !== 'a') return;
  clearTimeout(debounceHandle);
  debounceHandle = setTimeout(handleSelection, DEBOUNCE_MS);
});
