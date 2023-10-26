import { create } from "zustand";

import { persist, createJSONStorage, devtools } from "zustand/middleware";
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
  tabs: DBType[];
}

export const useTabsStore = create<TabsState>()(
  devtools(
    persist(
      (set) => ({
        tabs: [],
      }),
      {
        name: "tabsStore",
        storage: createJSONStorage(() => localStorage),
      }
    )
  )
);
