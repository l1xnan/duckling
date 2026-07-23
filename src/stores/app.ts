import type { QueryHistoryItem } from '@/lib/queryHistory';
import { TabContextType } from '@/stores/tabs';

import { createSelectors } from '@/stores/utils';
import { focusAtom } from 'jotai-optics';
import { atomWithStore } from 'jotai-zustand';
import { atomWithStorage } from 'jotai/utils';
import { debounce } from 'radash';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export const favoriteAtom = atomWithStorage<TabContextType[]>('favorite', []);
/** Query run history (newest items typically appended; UI sorts by createdAt). */
export const runsAtom = atomWithStorage<QueryHistoryItem[]>('runs', []);
/** SQL editor bodies (scratch id → text, or absolute path → text). Hydrate on init for migration. */
export const docsAtom = atomWithStorage<Record<string, string>>(
  'docs',
  {},
  undefined,
  { getOnInit: true },
);
/** Local SQL workspace folders shown in the Code sidebar. */
export const sqlFoldersAtom = atomWithStorage<string[]>('sqlFolders', []);

/** Saved SQL bookmarks (connection + statement + note). */
export type SqlBookmark = {
  id: string;
  dbId: string;
  stmt: string;
  title: string;
  note?: string;
  createdAt: number;
};
export const bookmarksAtom = atomWithStorage<SqlBookmark[]>('sqlBookmarks', []);

export const themeAtom = atomWithStorage<ThemeType>(
  'mode',
  'light',
  undefined,
  { getOnInit: true },
);

export type ThemeType = 'light' | 'dark' | 'system';

export const isDev = import.meta.env.MODE === 'development';
