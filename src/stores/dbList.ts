import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { debounce } from '@/utils';

import { computed } from './computed';
import { TabContextType } from './tabs';

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
  context: TabContextType;
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

type ComputedStore = {
  dbMap: Map<string, DBType>;
  dbTableMap: Map<string, Map<string, TreeNode>>;
};

type DBListStore = DBListState & DBListAction;

export function flattenTree(tree: TreeNode) {
  const result = new Map();
  function flatten(node: TreeNode) {
    result.set(node.path, node);
    if (node.children && node.children.length > 0) {
      node.children.forEach(flatten);
    }
  }
  flatten(tree);
  return result;
}

const computeState = (state: DBListStore): ComputedStore => {
  return {
    dbMap: new Map(state.dbList.map((db) => [db.id, db])),
    dbTableMap: new Map(
      state.dbList.map((db) => [db.id, flattenTree(db.data)]),
    ),
  };
};

export const useDBListStore = create<DBListStore & ComputedStore>()(
  computed(
    persist<DBListStore>(
      (set, _get) => ({
        // state
        size: 300,
        dbList: [],

        contextMenu: null,
        setContextMenu: (contextMenu: ContextMenuType) => {
          set(() => ({ contextMenu }));
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
        setCwd: (cwd: string, id: string) =>
          set((state) => ({
            dbList: state.dbList.map((item) => {
              return item.id == id
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
    computeState,
  ),
);
