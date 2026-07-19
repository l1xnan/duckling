import { LazyStore } from '@tauri-apps/plugin-store';
import type { StateStorage } from 'zustand/middleware';

function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

/**
 * Zustand storage backed by a local config file in the app data directory.
 * zustand hands us a JSON *string*; we store the parsed object so tauri-plugin-store
 * writes a readable file instead of an escaped string.
 * Falls back to localStorage outside Tauri (e.g. plain Vite web preview).
 *
 * Upgrade safety: localStorage is kept as a permanent redundant backup and is
 * never deleted. On first read, if the file is empty but localStorage holds a
 * legacy value, it is copied into the file.
 */
function createTauriFileStorage(fileName: string): StateStorage {
  const fileStore = new LazyStore(fileName);

  return {
    getItem: async (name: string): Promise<string | null> => {
      if (!isTauriRuntime()) {
        return localStorage.getItem(name);
      }

      try {
        const value = await fileStore.get<unknown>(name);
        if (value != null) {
          return JSON.stringify(value);
        }

        const legacy = localStorage.getItem(name);
        if (legacy != null) {
          await fileStore.set(name, JSON.parse(legacy));
          await fileStore.save();
          return legacy;
        }

        return null;
      } catch (error) {
        console.warn(
          `tauri store getItem failed (${fileName}), falling back to localStorage`,
          error,
        );
        return localStorage.getItem(name);
      }
    },

    setItem: async (name: string, value: string): Promise<void> => {
      if (!isTauriRuntime()) {
        localStorage.setItem(name, value);
        return;
      }

      try {
        await fileStore.set(name, JSON.parse(value));
        await fileStore.save();
        localStorage.setItem(name, value);
      } catch (error) {
        console.warn(
          `tauri store setItem failed (${fileName}), falling back to localStorage`,
          error,
        );
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
      } catch (error) {
        console.warn(
          `tauri store removeItem failed (${fileName}), falling back to localStorage`,
          error,
        );
      }
    },
  };
}

/** App settings → settings.json */
export const tauriFileStorage: StateStorage =
  createTauriFileStorage('settings.json');

/** Connection profiles (L1, no secrets) → connections.json */
export const connectionsFileStorage: StateStorage =
  createTauriFileStorage('connections.json');

/** Global SSH tunnel profiles (no secrets) → ssh-profiles.json */
export const sshProfilesFileStorage: StateStorage =
  createTauriFileStorage('ssh-profiles.json');

