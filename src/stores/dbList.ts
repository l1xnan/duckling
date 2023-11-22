import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import { debounce } from '@/utils';

import { DTableType } from './dataset';

export interface FileNode {
  name: string;
  type?: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

export type DBType = {
  id: string;

  // node tree
  data: FileNode;

  // config
  cwd?: string;
};

type ContextMenuType = {
  mouseX: number;
  mouseY: number;
  context: DTableType;
} | null;

type DBListState = {
  size: number;
  dbList: DBType[];
  contextMenu: ContextMenuType;
};

type DBListAction = {
  append: (db: DBType) => void;
  update: (db: Partial<FileNode>) => void;
  remove: (dbName: string) => void;
  setCwd: (cwd: string, path: string) => void;
  setSize: (size: number) => void;

  setContextMenu: (contextMenu: ContextMenuType) => void;
};

export const useDBListStore = create<DBListState & DBListAction>()(
  devtools(
    persist(
      (set) => ({
        // state
        size: 300,
        dbList: [],

        contextMenu: null,
        setContextMenu: (contextMenu: ContextMenuType) => {
          set((_) => ({ contextMenu }));
        },

        // action
        append: (db) => set((state) => ({ dbList: [...state.dbList, db] })),
        setSize: debounce((size) => set((_) => ({ size }))),
        remove: (dbName) =>
          set((state) => ({
            dbList: state.dbList?.filter(
              (item) => !(item.data.path === dbName),
            ),
          })),
        update: ({ path, children }) =>
          set((state) => ({
            dbList: state.dbList.map((item) => {
              if (item.data.path == path) {
                return {
                  ...item,
                  data: {
                    ...item.data,
                    children: children,
                  },
                };
              }
              return item;
            }),
          })),
        setCwd: (cwd: string, path: string) =>
          set((state) => ({
            dbList: state.dbList.map((item) => {
              return item.data.path == path
                ? {
                    ...item,
                    cwd,
                  }
                : item;
            }),
          })),
      }),
      {
        name: 'dbStore',
        storage: createJSONStorage(() => localStorage),
      },
    ),
  ),
);
