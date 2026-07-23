import type { QueryHistoryItem } from '@/lib/queryHistory';
import type { TabContextType } from '@/stores/tabs';
import { workspaceFileStorage } from '@/stores/tauriStore';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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

function readLegacyJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '') {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
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
      storage: createJSONStorage(() => workspaceFileStorage),
      partialize: (s) => ({
        sqlFolders: s.sqlFolders,
        bookmarks: s.bookmarks,
        runs: trimRuns(s.runs),
        favorite: s.favorite,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<WorkspaceState>;
        const hasFileData =
          (p.sqlFolders?.length ?? 0) > 0 ||
          (p.bookmarks?.length ?? 0) > 0 ||
          (p.runs?.length ?? 0) > 0 ||
          (p.favorite?.length ?? 0) > 0;

        // First run / empty file: pull legacy localStorage keys.
        const sqlFolders = hasFileData
          ? (p.sqlFolders ?? current.sqlFolders)
          : readLegacyJson<string[]>('sqlFolders', p.sqlFolders ?? []);
        const bookmarks = hasFileData
          ? (p.bookmarks ?? current.bookmarks)
          : readLegacyJson<SqlBookmark[]>(
              'sqlBookmarks',
              p.bookmarks ?? [],
            );
        const runs = hasFileData
          ? (p.runs ?? current.runs)
          : readLegacyJson<QueryHistoryItem[]>('runs', p.runs ?? []);
        const favorite = hasFileData
          ? (p.favorite ?? current.favorite)
          : readLegacyJson<TabContextType[]>('favorite', p.favorite ?? []);

        return {
          ...current,
          sqlFolders: sqlFolders ?? [],
          bookmarks: bookmarks ?? [],
          runs: trimRuns(runs ?? []),
          favorite: favorite ?? [],
        };
      },
    },
  ),
);
