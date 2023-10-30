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
  activeTab?: DTableType;
  append: (tab: DTableType) => void;
  remove: (tab: string) => void;
}

export const useTabsStore = create<TabsState>()(
  devtools(
    persist(
      (set) => ({
        tabs: [],
        append: (tab: DTableType) =>
          set((state) => ({ tabs: [...state.tabs, tab] })),
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
