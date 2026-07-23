import type { QueryHistoryItem } from '@/lib/queryHistory';
import {
  useWorkspaceStore,
  type SqlBookmark,
} from '@/stores/workspaceStore';

import { createSelectors } from '@/stores/utils';
import { focusAtom } from 'jotai-optics';
import { atomWithStore } from 'jotai-zustand';
import { atomWithStorage } from 'jotai/utils';
import { atom, type SetStateAction, type WritableAtom } from 'jotai';
import { debounce } from 'radash';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type { SqlBookmark };

type AppState = {
  size: number;
};

type AppAction = {
  setSize: (size: number) => void;
};

type AppStore = AppState & AppAction;

export const store = create<AppStore>()(
  persist<AppStore>(
    (set, _get) => ({
      size: 300,
      setSize: debounce({ delay: 300 }, (size) => set((_) => ({ size }))),
    }),
    {
      name: 'app',
    },
  ),
);

const useAppStore = createSelectors(store);

export const appAtom = atomWithStore(useAppStore);

export const sizeAtom = focusAtom(appAtom, (optic) => optic.prop('size'));

/** Bridge a workspace store slice to a jotai writable atom (useAtom compatible). */
function workspaceSliceAtom<T>(
  getSlice: () => T,
  setSlice: (next: T | ((prev: T) => T)) => void,
  subscribe: (listener: () => void) => () => void,
): WritableAtom<T, [SetStateAction<T>], void> {
  const base = atom(getSlice());
  base.onMount = (setAtom) => {
    setAtom(getSlice());
    return subscribe(() => {
      setAtom(getSlice());
    });
  };
  return atom(
    (get) => get(base),
    (_get, set, update: SetStateAction<T>) => {
      const prev = getSlice();
      const next =
        typeof update === 'function'
          ? (update as (p: T) => T)(prev)
          : update;
      setSlice(next);
      set(base, next);
    },
  );
}

const workspaceSubscribe = (listener: () => void) =>
  useWorkspaceStore.subscribe(listener);

export const favoriteAtom = workspaceSliceAtom(
  () => useWorkspaceStore.getState().favorite,
  (next) => useWorkspaceStore.getState().setFavorite(next),
  workspaceSubscribe,
);

/** Query run history (newest items typically appended; UI sorts by createdAt). */
export const runsAtom = workspaceSliceAtom(
  () => useWorkspaceStore.getState().runs,
  (next) => useWorkspaceStore.getState().setRuns(next),
  workspaceSubscribe,
);

/** SQL editor bodies (scratch id → text, or absolute path → text). Session cache. */
export const docsAtom = atomWithStorage<Record<string, string>>(
  'docs',
  {},
  undefined,
  { getOnInit: true },
);

/** Local SQL workspace folders shown in the Code sidebar. */
export const sqlFoldersAtom = workspaceSliceAtom(
  () => useWorkspaceStore.getState().sqlFolders,
  (next) => useWorkspaceStore.getState().setSqlFolders(next),
  workspaceSubscribe,
);

export const bookmarksAtom = workspaceSliceAtom(
  () => useWorkspaceStore.getState().bookmarks,
  (next) => useWorkspaceStore.getState().setBookmarks(next),
  workspaceSubscribe,
);

export const themeAtom = atomWithStorage<ThemeType>(
  'mode',
  'light',
  undefined,
  { getOnInit: true },
);

export type ThemeType = 'light' | 'dark' | 'system';

export const isDev = import.meta.env.MODE === 'development';

// Re-export type used by consumers that imported QueryHistoryItem via runs only
export type { QueryHistoryItem };
