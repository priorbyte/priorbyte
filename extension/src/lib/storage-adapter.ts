/**
 * GoTrue-compatible storage backed by chrome.storage.local.
 *
 * Extension contexts (popup, background, content scripts) don't share
 * localStorage, so the default supabase-js storage silently fails to persist
 * a session across them. chrome.storage.local is the one thing all three see.
 */
export const chromeStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const result = await chrome.storage.local.get(key);
    return (result[key] as string | undefined) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },
  async removeItem(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  },
};
