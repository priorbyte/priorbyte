import { captureLearningEvent } from '~lib/capture';
import type { ExtensionMessage } from '~lib/messages';

/**
 * Only writer to Supabase in the whole extension. Content scripts and the
 * popup never hold the client directly for capture — routing everything
 * through here keeps the write path (and its validation) in one place.
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type !== 'CAPTURE_EVENT') return undefined;

  captureLearningEvent(message.payload).then(sendResponse);
  return true; // keep the message channel open for the async response
});
