import { LazyStore } from '@tauri-apps/plugin-store';
import type { StateStorage } from 'zustand/middleware';

/** Settings file under app data dir (via tauri-plugin-store). */
const SETTINGS_FILE = 'settings.json';

const fileStore = new LazyStore(SETTINGS_FILE);

function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

/**
 * Zustand storage backed by a local config file in the app data directory.
 * zustand hands us a JSON *string*; we store the parsed object so tauri-plugin-store
 * writes a readable `{"setting": {...}}` file instead of an escaped string.
 * Falls back to localStorage outside Tauri (e.g. plain Vite web preview).
 *
 * Upgrade safety: localStorage is kept as a permanent redundant backup and is
 * never deleted. On first read, if the file is empty but localStorage holds a
 * legacy value, it is copied into the file. If the file later becomes
 * unreadable, localStorage still restores the settings.
 */
export const tauriFileStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (!isTauriRuntime()) {
      return localStorage.getItem(name);
    }

    try {
      const value = await fileStore.get<unknown>(name);
      if (value != null) {
        // Return the minified JSON string zustand expects.
        return JSON.stringify(value);
      }

      // File empty: try to restore from the localStorage backup (upgrade path).
      const legacy = localStorage.getItem(name);
      if (legacy != null) {
        await fileStore.set(name, JSON.parse(legacy));
        await fileStore.save();
        // Keep localStorage as a backup — do NOT remove it.
        return legacy;
      }

      return null;
    } catch (error) {
      console.warn('tauri store getItem failed, falling back to localStorage', error);
      return localStorage.getItem(name);
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (!isTauriRuntime()) {
      localStorage.setItem(name, value);
      return;
    }

    try {
      // Store the parsed object so the on-disk file stays readable.
      await fileStore.set(name, JSON.parse(value));
      await fileStore.save();
      // Mirror to localStorage as a redundant backup for upgrade safety.
      localStorage.setItem(name, value);
    } catch (error) {
      console.warn('tauri store setItem failed, falling back to localStorage', error);
      localStorage.setItem(name, value);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    if (!isTauriRuntime()) {
      localStorage.removeItem(name);
      return;
    }

    try {
      await fileStore.delete(name);
      await fileStore.save();
      // Keep the localStorage backup so settings can be restored on upgrade.
    } catch (error) {
      console.warn('tauri store removeItem failed, falling back to localStorage', error);
    }
  },
};

