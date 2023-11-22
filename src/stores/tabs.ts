import { debounce } from '@mui/material';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import { DTableType } from './dataset';
export interface FileNode {
  name: string;
  type?: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

export type DBType = {
  data: FileNode;
  cwd?: string;
};

interface TabsState {
  tabs: DTableType[];
  table?: DTableType;

  docs: { [key: string]: string };
}

type TabsAction = {
  append: (tab: DTableType) => void;
  update: (tab: DTableType) => void;
  remove: (key: string) => void;
  active: (idx: string) => void;

  setStmt: (key: string, value: string) => void;
};

export const useTabsStore = create<TabsState & TabsAction>()(
  devtools(
    // immer(
    persist(
      (set, _get) => ({
        tabs: [],
        table: undefined,

        docs: {},
        append: (tab: DTableType) =>
          set((state) => ({ tabs: [...state.tabs, tab] })),
        active: (index) =>
          set((state) => {
            const idx = state.tabs.findIndex(({ id }) => id === index);
            return { table: state.tabs[idx] };
          }),
        update: (item: DTableType) => {
          set((state) => {
            let tabs = state.tabs;
            if (tabs.findIndex(({ id }) => id === item.id) < 0) {
              tabs = [...tabs, item];
            }
            return { table: item, tabs };
          });
        },
        remove: (key) => {
          set((state) => {
            const tabs = state.tabs;
            let table = state.table;
            const delIndex = tabs.findIndex(({ id }) => id === key);
            const updatedTabs = tabs.filter((_tab, index) => {
              return index !== delIndex;
            });

            if (key == table?.id) {
              table = tabs[delIndex - 1] || tabs[delIndex + 1] || undefined;
            }

            return {
              tabs: updatedTabs,
              table,
            };
          });
        },

        setStmt: debounce((key, stmt) =>
          set((state) => ({
            docs: { ...state.docs, [key]: stmt },
          })),
        ),
      }),
      {
        name: 'tabsStore',
        storage: createJSONStorage(() => localStorage),
      },
    ),
    // )
  ),
);
