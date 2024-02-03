import { atom, createStore } from 'jotai';
import { splitAtom } from 'jotai/utils';
import { focusAtom } from 'jotai-optics';
import { atomWithStore } from 'jotai-zustand';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { TreeNode } from '@/types';

import { computed } from './computed';

export type NodeContextType = {
  id?: string;
  dbId: string;
  tableId: string;
  type?: string;
  extra?: unknown;
};

export type DialectType = 'folder' | 'file' | 'duckdb' | 'clickhouse';

export type DuckdbConfig = {
  path: string;
  cwd?: string;
  dialect: DialectType;
};

export type FolderConfig = {
  path: string;
  cwd?: string;
  dialect: DialectType;
};
export type FileConfig = {
  dialect: 'file';
  path: string;
};

export type ClickhouseDialectType = {
  host: string;
  port: string;
  password: string;
  username: string;
  database: string;
  dialect: DialectType;
};

export type DialectConfig =
  | DuckdbConfig
  | ClickhouseDialectType
  | FolderConfig
  | FileConfig;

export type DBType = {
  id: string;
  dialect: DialectType;

  displayName: string;
  // tree node
  data: TreeNode;

  config?: DialectConfig;
};

type ContextMenuType = {
  mouseX: number;
  mouseY: number;
  context: NodeContextType;
} | null;

type DBListState = {
  dbList: DBType[];
  contextMenu: ContextMenuType;
};

type DBListAction = {
  append: (db: DBType) => void;
  update: (id: string, data: TreeNode) => void;
  // remove db by db id
  remove: (id: string) => void;
  rename: (id: string, displayName: string) => void;
  setCwd: (cwd: string, id: string) => void;

  setContextMenu: (contextMenu: ContextMenuType) => void;
};

type ComputedStore = {
  databases: Map<string, DBType>;
  tables: Map<string, Map<string, TreeNode>>;
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
    databases: new Map(state.dbList.map((db) => [db.id, db])),
    tables: new Map(state.dbList.map((db) => [db.id, flattenTree(db.data)])),
  };
};

export const useDBListStore = create<DBListStore & ComputedStore>()(
  computed(
    persist<DBListStore>(
      (set, _get) => ({
        // state
        dbList: [],

        contextMenu: null,
        setContextMenu: (contextMenu: ContextMenuType) => {
          set(() => ({ contextMenu }));
        },

        // action
        append: (db) => set((state) => ({ dbList: [...state.dbList, db] })),
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
                    config: { ...(item.config ?? {}), cwd } as DialectConfig,
                  }
                : item;
            }),
          })),
        rename: (dbId: string, displayName: string) => {
          set(({ dbList }) => ({
            dbList: dbList.map((item) => {
              return item.id == dbId
                ? {
                    ...item,
                    displayName,
                  }
                : item;
            }),
          }));
        },
      }),
      {
        name: 'dbListStore',
        storage: createJSONStorage(() => localStorage),
      },
    ),
    computeState,
  ),
);

const storeAtom = atomWithStore(useDBListStore);
export const dbListAtom = focusAtom(storeAtom, (o) => o.prop('dbList'));
export const dbMapAtom = atom((get) => {
  return new Map(get(storeAtom).dbList.map((db) => [db.id, db]));
});

export const tablesAtom = atom((get) => {
  return new Map(
    get(storeAtom).dbList.map((db) => [db.id, flattenTree(db.data)]),
  );
});

export const dbAtomsAtom = splitAtom(dbListAtom);

export const selectedNodeAtom = atom<NodeContextType | null>(null);

// db rename
export const renameAtom = atom<DBType | null>(null);
// db setting
export const configAtom = atom<DBType | null>(null);

export const atomStore = createStore();
