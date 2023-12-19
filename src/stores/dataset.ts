import { createContext, useContext } from 'react';
import { createStore, useStore } from 'zustand';

import { query } from '@/api';
import { genStmt } from '@/utils';

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
    page: 1,
    perPage: 500,
    context,
    totalCount: 0,
    schema: [],
    data: [],
    sqlWhere: undefined,
    code: 0,
    message: undefined,
    beautify: true,

    // action
    setStore: (res: object) => set((_) => res),
    increase: () => set((state) => ({ page: state.page + 1 })),
    setBeautify: () => set((state) => ({ beautify: !state.beautify })),
    toFirst: () => set((_) => ({ page: 1 })),
    setSQLWhere: (value: string) => set((_) => ({ sqlWhere: value })),
    setDialogColumn: (dialogColumn: string) => set((_) => ({ dialogColumn })),
    toLast: () =>
      set((state) => {
        console.log(Math.ceil(state.totalCount / state.perPage));
        return { page: Math.ceil(state.totalCount / state.perPage) };
      }),
    setOrderBy: (name: string) =>
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
      }),
    setPerPage: (perPage: number) => set((_) => ({ perPage })),
    decrease: () => set((state) => ({ page: state.page - 1 })),
    refresh: async (stmt?: string) => {
      const { page, perPage, context: table, sqlWhere } = get();
      console.log('inner:', get());
      if (!table || !table.tableName) {
        return;
      }

      let path = ':memory:';
      let tableName = table.tableName;

      if (table?.dbName?.endsWith('.duckdb')) {
        path = table.dbName;
      } else if (tableName.endsWith('.csv')) {
        tableName = `read_csv_auto('${table.tableName}')`;
      } else if (tableName.endsWith('.parquet')) {
        tableName = `read_parquet('${table.tableName}')`;
      }

      const sql =
        stmt ??
        genStmt({
          tableName,
          orderBy: get().orderBy,
          where: sqlWhere,
        });

      console.log('query:', path, sql);
      const data = await query({
        path,
        sql,
        limit: perPage,
        offset: (page - 1) * perPage,
        cwd: table.cwd,
      });
      set({ ...data });
    },
  }));
