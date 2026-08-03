import type { CaptureLearningEventInput } from '@priorbyte/shared/schemas';

/** Internal message contract between content scripts, popup, and the background worker. */
export type ExtensionMessage = { type: 'CAPTURE_EVENT'; payload: CaptureLearningEventInput };

export function sendCaptureMessage(payload: CaptureLearningEventInput): void {
  const message: ExtensionMessage = { type: 'CAPTURE_EVENT', payload };
  chrome.runtime.sendMessage(message).catch(() => {
    // The background worker can be asleep on first fire (MV3 service worker
    // lifecycle) — sendMessage wakes it, and the dropped reply here is fine
    // because callers don't wait on a result for passive capture.
  });
}
