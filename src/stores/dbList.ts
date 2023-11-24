import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import { debounce } from '@/utils';

import { DTableType } from './dataset';

export interface TreeNode {
  name: string;
  type?: string;
  path: string;
  is_dir: boolean;
  children?: TreeNode[];
}

export type DialectType = 'folder' | 'file' | 'duckdb';

export type DBType = {
  id: string;
  dialect: DialectType;

  // node tree
  data: TreeNode;

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
  update: (id: string, data: TreeNode) => void;
  // remove db by db id
  remove: (id: string) => void;
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
        remove: (id) =>
          set((state) => ({
            dbList: state.dbList?.filter((item) => !(item.id === id)),
          })),
        update: (id, data) =>
          set((state) => ({
            dbList: state.dbList.map((item) =>
              item.id !== id
                ? item
                : {
                    ...item,
                    data,
                  },
            ),
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
        name: 'dbListStore',
        storage: createJSONStorage(() => localStorage),
      },
    ),
  ),
);
