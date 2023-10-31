import { create } from "zustand";

import { persist, createJSONStorage, devtools } from "zustand/middleware";
import { DTableType } from "./store";
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
  current?: DTableType;
  append: (tab: DTableType) => void;
  update: (tab: DTableType) => void;
  remove: (tab: string) => void;
  active: (tab: DTableType) => void;
}

export const useTabsStore = create<TabsState>()(
  devtools(
    persist(
      (set, get) => ({
        tabs: [],
        append: (tab: DTableType) =>
          set((state) => ({ tabs: [...state.tabs, tab] })),
        active: (tab: DTableType) => set((_) => ({ current: tab })),
        update: (item: DTableType) => {
          if (
            !get()
              .tabs?.map((tab) => tab.tableName)
              .includes(item.tableName)
          ) {
            get().append(item);
          }
          get().active(item);
        },
        remove: (dbName: string) =>
          set((state) => ({
            tabs: state.tabs?.filter((item) => !(item.tableName === dbName)),
          })),
      }),
      {
        name: "tabsStore",
        storage: createJSONStorage(() => localStorage),
      }
    )
  )
);
