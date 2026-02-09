/// <reference types="chrome" />

/**
 * Type-safe wrapper for Chrome storage API
 */

export const storage = {
  /**
   * Get a value from local storage
   */
  async get<T>(key: string): Promise<T | undefined> {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  },

  /**
   * Set a value in local storage
   */
  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },

  /**
   * Remove a value from local storage
   */
  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  },

  /**
   * Clear all local storage
   */
  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  },

  /**
   * Get multiple values from local storage
   */
  async getMultiple<T extends Record<string, unknown>>(keys: string[]): Promise<T> {
    const result = await chrome.storage.local.get(keys);
    return result as T;
  },

  /**
   * Set multiple values in local storage
   */
  async setMultiple<T extends Record<string, unknown>>(items: T): Promise<void> {
    await chrome.storage.local.set(items);
  },
};

export const syncStorage = {
  /**
   * Get a value from sync storage
   */
  async get<T>(key: string): Promise<T | undefined> {
    const result = await chrome.storage.sync.get(key);
    return result[key] as T | undefined;
  },

  /**
   * Set a value in sync storage
   */
  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.sync.set({ [key]: value });
  },

  /**
   * Remove a value from sync storage
   */
  async remove(key: string): Promise<void> {
    await chrome.storage.sync.remove(key);
  },
};

/**
 * Subscribe to storage changes
 */
export function onStorageChange(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local') {
      callback(changes);
    }
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
