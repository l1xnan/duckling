import { debounce } from '@mui/material';
import { atom } from 'jotai';
import { atomFamily, splitAtom } from 'jotai/utils';
// eslint-disable-next-line import/order
import { focusAtom } from 'jotai-optics';
import { atomWithStore } from 'jotai-zustand';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export type QueryContextType = {
  id: string;
  dbId: string;
  tableId: string;
  type?: string;
  extra?: unknown;
  displayName: string;

  stmt: string;
};
export type EditorContextType = {
  id: string;
  dbId: string;
  tableId: string;
  type?: string;
  extra?: unknown;
  displayName: string;
};

export type TableContextType = {
  id: string;
  dbId: string;
  tableId: string;
  type?: string;
  extra?: unknown;
  displayName: string;
};

export type TabContextType =
  | TableContextType
  | EditorContextType
  | QueryContextType;

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

export const tabsAtom = atomWithStore(useTabsStore);
export const tabListAtom = focusAtom(tabsAtom, (o) => o.prop('tabs'));

export const tabsAtomsAtom = splitAtom(tabListAtom);

export const queryTabsAtom = atom<Record<string, unknown>>({});

export type SubTab = {
  id: string;
  activeKey?: string;
  children: QueryContextType[];
};

export const subTabsAtomFamily = atomFamily(
  (item: SubTab) => atom(item),
  (a: Partial<SubTab>, b: Partial<SubTab>) => a.id === b.id,
);
