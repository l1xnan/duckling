import { createStore, useStore } from "zustand";
import { genStmt } from "@/utils";
import { createContext, useContext } from "react";
import { query } from "@/api";
export type SchemaType = {
  name: string;
  dataType: string;
  type: any;
  nullable: boolean;
  metadata: any;
};

export interface ArrowResponse {
  total: number;
  data: Array<number>;
  code: number;
  message: string;
}

export type DTableType = {
  rootKey: number;
  root: string;
  tableName: string;
  cwd?: string;
  id: string;
};

export type DatasetField = {
  page: number;
  totalCount: number;
  data: any[];
  perPage: number;
  tableName?: string;
  table?: DTableType;
  code?: number;
  message?: string;
  schema: SchemaType[];
  orderBy?: OrderByType;
  sqlWhere?: string;
  beautify?: boolean;
};

export interface DatasetState extends DatasetField {
  setStore?: (res: Partial<DatasetField>) => void;
  setOrderBy?: (name: string) => void;
  setPerPage?: (perPage: number) => void;
  increase: () => void;
  toFirst: () => void;
  toLast: () => void;
  decrease: () => void;
  setSQLWhere: (value: string) => void;
  refresh: () => Promise<void>;
  setBeautify: () => void;
}

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
  typeof createPageStore
> | null>(null);

export const usePageStore = () => {
  const store = useContext(PageContext);
  if (store === null) {
    throw new Error("no provider");
  }
  return useStore(store);
};

export const createPageStore = (table: DTableType) =>
  createStore<DatasetState>((set, get) => ({
    page: 1,
    perPage: 500,
    table,
    totalCount: 0,
    schema: [],
    data: [],
    sqlWhere: undefined,
    code: 0,
    message: undefined,
    beautify: true,
    setStore: (res: object) => set((_) => res),
    increase: () => set((state) => ({ page: state.page + 1 })),
    setBeautify: () => set((state) => ({ beautify: !state.beautify })),
    toFirst: () => set((_) => ({ page: 1 })),
    setSQLWhere: (value: string) => set((_) => ({ sqlWhere: value })),
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
          } else {
            return {
              orderBy: undefined,
            };
          }
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
    refresh: async () => {
      const page = get().page;
      const perPage = get().perPage;
      const table = get().table;
      const sqlWhere = get().sqlWhere;
      console.log("inner:", get());
      if (!table || !table.tableName) {
        return;
      }

      let path = ":memory:";
      let tableName = table.tableName;

      if (table?.root?.endsWith(".duckdb")) {
        path = table.root;
      } else if (tableName.endsWith(".csv")) {
        tableName = `read_csv('${table.tableName}')`;
      } else if (tableName.endsWith(".parquet")) {
        tableName = `read_parquet('${table.tableName}')`;
      }

      const sql = genStmt({
        tableName,
        orderBy: get().orderBy,
        where: sqlWhere,
      });

      console.log("query:", path, sql);
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
