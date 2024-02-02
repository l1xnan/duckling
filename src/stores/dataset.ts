import { createContext, useContext } from 'react';
import { createStore, useStore } from 'zustand';

import { query } from '@/api';
import { genStmt } from '@/utils';

import { atomStore, dbMapAtom, tablesAtom } from './dbList';
import { TabContextType } from './tabs';

export type SchemaType = {
  name: string;
  dataType: string;
  type: string;
  nullable: boolean;
  metadata: unknown;
};

export interface ArrowResponse {
  total: number;
  data: Array<number>;
  code: number;
  message: string;
}

export type DatasetState = {
  // current tab context(database, table, etc)
  context?: TabContextType;

  page: number;
  perPage: number;
  totalCount: number;

  data: unknown[];

  tableName?: string;
  code?: number;
  message?: string;
  schema: SchemaType[];
  orderBy?: OrderByType;
  sqlWhere?: string;
  beautify?: boolean;
  dialogColumn?: string;
};

export type DatasetAction = {
  setStore?: (res: Partial<DatasetState>) => void;
  setOrderBy?: (name: string) => void;
  setPerPage?: (perPage: number) => void;
  increase: () => void;
  toFirst: () => void;
  toLast: () => void;
  decrease: () => void;
  setSQLWhere: (value: string) => void;
  setDialogColumn: (value: string) => void;
  refresh: (stmt?: string) => Promise<void>;
  setBeautify: () => void;
};

export type OrderByType = {
  name: string;
  desc: boolean;
};

export type StmtType = {
  tableName: string;
  page?: number;
  perPage?: number;
  orderBy?: OrderByType;
  where?: string;
};

export const PageContext = createContext<ReturnType<
  typeof createDatasetStore
> | null>(null);

export const usePageStore = () => {
  const store = useContext(PageContext);
  if (store === null) {
    throw new Error('no provider');
  }
  return useStore(store);
};

export const createDatasetStore = (context: TabContextType) =>
  createStore<DatasetState & DatasetAction>((set, get) => ({
    // state
    context,

    page: 1,
    perPage: 500,
    totalCount: 0,
    schema: [],
    data: [],
    sqlWhere: undefined,
    code: 0,
    message: undefined,
    beautify: true,

    // action
    setStore: (res: object) => set((_) => res),
    increase: () => {
      set((state) => ({ page: state.page + 1 }));
      get().refresh();
    },
    setBeautify: () => set((state) => ({ beautify: !state.beautify })),
    toFirst: () => {
      set((_) => ({ page: 1 }));
      get().refresh();
    },
    setSQLWhere: (value: string) => {
      set((_) => ({ sqlWhere: value }));
      get().refresh();
    },
    setDialogColumn: (dialogColumn: string) => set((_) => ({ dialogColumn })),
    toLast: () => {
      set((state) => {
        return { page: Math.ceil(state.totalCount / state.perPage) };
      });
      get().refresh();
    },
    setOrderBy: (name: string) => {
      set((state) => {
        const { name: prevName, desc } = state?.orderBy ?? {};
        if (name == prevName) {
          if (!desc) {
            return {
              orderBy: {
                name,
                desc: true,
              },
            };
          }
          return {
            orderBy: undefined,
          };
        }
        return {
          orderBy: {
            name,
            desc: false,
          },
        };
      });
      get().refresh();
    },
    setPerPage: (perPage: number) => set((_) => ({ perPage })),
    decrease: () => {
      set((state) => ({ page: state.page - 1 }));
      get().refresh();
    },
    refresh: async (stmt?: string) => {
      const { page, perPage, context, sqlWhere } = get();

      const dbId = context?.dbId;

      if (!dbId) {
        return;
      }

      const dbMap = atomStore.get(dbMapAtom);

      const db = dbMap.get(dbId);
      if (!db) {
        return;
      }

      let sql = stmt;

      if (!sql) {
        const tableMap = atomStore.get(tablesAtom);
        const table = tableMap.get(dbId)?.get(context?.tableId ?? '');

        let tableName = table.path;
        if (table.path.endsWith('.csv')) {
          tableName = `read_csv_auto('${table.path}')`;
        } else if (table.path.endsWith('.parquet')) {
          tableName = `read_parquet('${table.path}')`;
        }
        sql = genStmt({
          tableName,
          orderBy: get().orderBy,
          where: sqlWhere,
        });
      }
      console.log('query:', sql);
      const data = await query({
        sql,
        limit: perPage,
        offset: (page - 1) * perPage,
        dialect: db?.config,
      });
      set({ ...data });
    },
  }));
