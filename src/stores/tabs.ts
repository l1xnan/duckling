import { debounce } from '@mui/material';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export type TabContextType = {
  dbId: string;
  id: string;
  type?: string;

  // displayName?: string;
  // dbName: string;
  // tableName: string;
  // cwd?: string;

  extra?: unknown;
};

interface TabsState {
  tabs: TabContextType[];
  currentTab?: TabContextType;

  docs: { [key: string]: string };
}

type TabsAction = {
  append: (tab: TabContextType) => void;
  update: (tab: TabContextType) => void;
  remove: (key: string) => void;
  active: (idx: string) => void;

  setStmt: (key: string, value: string) => void;
};

export const useTabsStore = create<TabsState & TabsAction>()(
  immer(
    persist(
      (set, _get) => ({
        tabs: [],
        currentTab: undefined,

        docs: {},
        append: (tab: TabContextType) =>
          set((state) => ({ tabs: [...state.tabs, tab] })),
        active: (index) =>
          set((state) => {
            const idx = state.tabs.findIndex(({ id }) => id === index);
            return { currentTab: state.tabs[idx] };
          }),
        update: (item: TabContextType) => {
          set((state) => {
            let tabs = state.tabs;
            if (tabs.findIndex(({ id }) => id === item.id) < 0) {
              tabs = [...tabs, item];
            }
            return { currentTab: item, tabs };
          });
        },
        remove: (key) => {
          set((state) => {
            const tabs = state.tabs;
            let table = state.currentTab;
            const delIndex = tabs.findIndex(({ id }) => id === key);
            const updatedTabs = tabs.filter((_tab, index) => {
              return index !== delIndex;
            });

            if (key == table?.id) {
              table = tabs[delIndex - 1] || tabs[delIndex + 1] || undefined;
            }

            return {
              tabs: updatedTabs,
              currentTab: table,
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
  ),
);
