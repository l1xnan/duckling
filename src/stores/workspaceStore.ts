import type { QueryHistoryItem } from '@/lib/queryHistory';
import type { TabContextType } from '@/stores/tabs';
import { workspaceFileStorage } from '@/stores/tauriStore';
import { create } from 'zustand';
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from 'zustand/middleware';

const MAX_RUNS = 500;

export type SqlBookmark = {
  id: string;
  dbId: string;
  stmt: string;
  title: string;
  note?: string;
  createdAt: number;
};

type WorkspaceState = {
  sqlFolders: string[];
  bookmarks: SqlBookmark[];
  runs: QueryHistoryItem[];
  favorite: TabContextType[];
};

type WorkspaceAction = {
  setSqlFolders: (
    next: string[] | ((prev: string[]) => string[]),
  ) => void;
  setBookmarks: (
    next: SqlBookmark[] | ((prev: SqlBookmark[]) => SqlBookmark[]),
  ) => void;
  setRuns: (
    next:
      | QueryHistoryItem[]
      | ((prev: QueryHistoryItem[]) => QueryHistoryItem[]),
  ) => void;
  setFavorite: (
    next:
      | TabContextType[]
      | ((prev: TabContextType[]) => TabContextType[]),
  ) => void;
};

export type WorkspaceStore = WorkspaceState & WorkspaceAction;

function readLegacyJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '') {
      return undefined;
    }
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function trimRuns(runs: QueryHistoryItem[]): QueryHistoryItem[] {
  if (runs.length <= MAX_RUNS) {
    return runs;
  }
  // Prefer newest first (UI appends to front).
  return runs.slice(0, MAX_RUNS);
}

function resolveNext<T>(
  prev: T,
  next: T | ((prev: T) => T),
): T {
  return typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
}

/**
 * Build workspace state from pre-workspace localStorage keys written by jotai
 * atomWithStorage (`sqlFolders`, `sqlBookmarks`, `runs`, `favorite`).
 * Returns null when nothing legacy exists.
 */
export function readLegacyWorkspaceFromLocalStorage(): WorkspaceState | null {
  const sqlFolders = readLegacyJson<string[]>('sqlFolders');
  const bookmarks = readLegacyJson<SqlBookmark[]>('sqlBookmarks');
  const runs = readLegacyJson<QueryHistoryItem[]>('runs');
  const favorite = readLegacyJson<TabContextType[]>('favorite');

  const hasAny =
    sqlFolders != null ||
    bookmarks != null ||
    runs != null ||
    favorite != null;
  if (!hasAny) {
    return null;
  }

  return {
    sqlFolders: Array.isArray(sqlFolders) ? sqlFolders : [],
    bookmarks: Array.isArray(bookmarks) ? bookmarks : [],
    runs: trimRuns(Array.isArray(runs) ? runs : []),
    favorite: Array.isArray(favorite) ? favorite : [],
  };
}

const WORKSPACE_MIGRATED_FLAG = 'workspaceMigratedV1';

function isEmptyWorkspaceState(state: Partial<WorkspaceState> | null | undefined): boolean {
  if (!state) {
    return true;
  }
  return (
    !(state.sqlFolders?.length) &&
    !(state.bookmarks?.length) &&
    !(state.runs?.length) &&
    !(state.favorite?.length)
  );
}

function markWorkspaceMigrated() {
  try {
    localStorage.setItem(WORKSPACE_MIGRATED_FLAG, '1');
  } catch {
    // ignore
  }
}

function hasWorkspaceMigratedFlag(): boolean {
  try {
    return localStorage.getItem(WORKSPACE_MIGRATED_FLAG) === '1';
  } catch {
    return false;
  }
}

/**
 * Storage wrapper: when `workspace` file/key is missing (or empty before first
 * successful migrate), one-shot migrate from legacy jotai LS keys.
 *
 * Critical: createTauriFileStorage only falls back to LS key === persist name
 * (`workspace`), but legacy data lives under different keys (`sqlFolders`, …).
 */
const workspaceMigratingStorage: StateStorage = {
  getItem: async (name) => {
    const existing = await workspaceFileStorage.getItem(name);
    const legacy = readLegacyWorkspaceFromLocalStorage();
    const migrated = hasWorkspaceMigratedFlag();

    if (existing != null) {
      // Already migrated or has real data — use file as-is.
      if (migrated) {
        return existing;
      }
      // Broken first-boot may have written an empty workspace.json before legacy
      // keys were imported. Recover once while flag is unset.
      try {
        const parsed = JSON.parse(existing) as {
          state?: Partial<WorkspaceState>;
          version?: number;
        };
        const state = parsed.state ?? (parsed as unknown as Partial<WorkspaceState>);
        if (!isEmptyWorkspaceState(state) || !legacy) {
          markWorkspaceMigrated();
          return existing;
        }
        const payload = JSON.stringify({
          state: legacy,
          version: parsed.version ?? 0,
        });
        await workspaceFileStorage.setItem(name, payload);
        markWorkspaceMigrated();
        return payload;
      } catch {
        markWorkspaceMigrated();
        return existing;
      }
    }

    if (!legacy) {
      markWorkspaceMigrated();
      return null;
    }

    // zustand createJSONStorage expects `{ state, version }`.
    const payload = JSON.stringify({ state: legacy, version: 0 });
    try {
      await workspaceFileStorage.setItem(name, payload);
    } catch (e) {
      console.warn('workspace legacy migrate write failed', e);
    }
    markWorkspaceMigrated();
    return payload;
  },
  setItem: (name, value) => workspaceFileStorage.setItem(name, value),
  removeItem: (name) => workspaceFileStorage.removeItem(name),
};

const defaultState: WorkspaceState = {
  sqlFolders: [],
  bookmarks: [],
  runs: [],
  favorite: [],
};

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      ...defaultState,
      setSqlFolders: (next) =>
        set({ sqlFolders: resolveNext(get().sqlFolders, next) }),
      setBookmarks: (next) =>
        set({ bookmarks: resolveNext(get().bookmarks, next) }),
      setRuns: (next) =>
        set({ runs: trimRuns(resolveNext(get().runs, next)) }),
      setFavorite: (next) =>
        set({ favorite: resolveNext(get().favorite, next) }),
    }),
    {
      name: 'workspace',
      storage: createJSONStorage(() => workspaceMigratingStorage),
      partialize: (s) => ({
        sqlFolders: s.sqlFolders,
        bookmarks: s.bookmarks,
        runs: trimRuns(s.runs),
        favorite: s.favorite,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<WorkspaceState>;
        return {
          ...current,
          sqlFolders: Array.isArray(p.sqlFolders)
            ? p.sqlFolders
            : current.sqlFolders,
          bookmarks: Array.isArray(p.bookmarks)
            ? p.bookmarks
            : current.bookmarks,
          runs: trimRuns(
            Array.isArray(p.runs) ? p.runs : current.runs,
          ),
          favorite: Array.isArray(p.favorite)
            ? p.favorite
            : current.favorite,
        };
      },
    },
  ),
);
