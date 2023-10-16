import { Table, tableFromIPC } from "@apache-arrow/ts";
import { invoke } from "@tauri-apps/api/tauri";
import { create } from "zustand";
import { useQuery } from "@tanstack/react-query";
export type SchemaType = {
  name: string;
  dataType: string;
  type: any;
  nullable: boolean;
  metadata: any;
};

interface ValidationResponse {
  row_count: number;
  total_count: number;
  preview: Array<number>;
}

export interface DatasetState {
  page: number;
  totalCount: number;
  data: any[];
  perPage: number;
  tableName?: string;
  schema: SchemaType[];
  orderBy?: OrderByType;
  setStore?: (res: object) => void;
  setOrderBy?: (name: string) => void;
  increase: () => void;
  toFirst: () => void;
  toLast: () => void;
  setTableName: (tableName: string) => void;
  decrease: () => void;
  refresh: () => Promise<void>;
}

type OrderByType = {
  name: string;
  desc: boolean;
};

type StmtType = {
  path: string;
  page?: number;
  perPage?: number;
  orderBy?: OrderByType;
};

function genStmt({ path, orderBy }: StmtType) {
  let stmt = `select * from read_parquet('${path}')`;
  if (!!orderBy && orderBy.name) {
    const { name, desc } = orderBy;
    stmt = `${stmt} order by ${name} ${desc ? "DESC" : ""}`;
  }
  return stmt;
}

export const useStore = create<DatasetState>((set, get) => ({
  page: 1,
  perPage: 500,
  tableName: undefined,
  totalCount: 0,
  schema: [],
  data: [],
  orderBy: undefined,
  setStore: (res: object) => set((_) => res),
  increase: () => set((state) => ({ page: state.page + 1 })),
  toFirst: () => set((_) => ({ page: 1 })),
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
  setTableName: (tableName: string) => set((_) => ({ tableName })),
  decrease: () => set((state) => ({ page: state.page - 1 })),
  refresh: async () => {
    const page = get().page;
    const perPage = get().perPage;
    const tableName = get().tableName;
    if (!!tableName) {
      const sql = genStmt({ path: tableName, orderBy: get().orderBy });
      console.log("sql:", sql, get().orderBy);
      const data = await query(sql, perPage, (page - 1) * perPage);
      set({ ...data });
    }
  },
}));

interface ValidationResponse {
  row_count: number;
  total_count: number;
  preview: Array<number>;
}

type ResultType = { totalCount: number; data: any[]; schema: SchemaType[] };

type OptionType = {
  limit: number;
  offset: number;
  order?: string;
};

export function convert(preview: Array<number>, totalCount: number) {
  const table: Table = tableFromIPC(Uint8Array.from(preview));
  const schema: SchemaType[] = table.schema.fields.map((field: any) => {
    return {
      name: field.name,
      dataType: field.type.toString(),
      type: field.type,
      nullable: field.nullable,
      metadata: field.metadata,
    };
  });

  const data = table.toArray().map((item: any, i: number) => ({
    __index__: i + 1,
    ...item.toJSON(),
  }));

  console.table([...data.slice(0, 10)]);
  console.table(schema);
  return {
    totalCount,
    data,
    schema,
  };
}

export async function query(
  sql: string,
  limit: number,
  offset: number
): Promise<ResultType> {
  const { preview, total_count }: ValidationResponse = await invoke("query", {
    sql,
    limit,
    offset,
  });
  return convert(preview, total_count);
}

export async function read_parquet(
  path: string,
  { limit = 500, offset = 0, order }: OptionType
): Promise<ResultType> {
  const { preview, total_count }: ValidationResponse = await invoke(
    "read_parquet",
    { path, limit, offset, order }
  );
  return convert(preview, total_count);
}

export const useParquet = () => {
  const page = useStore((state) => state.page);
  const perPage = useStore((state) => state.perPage);
  const tableName = useStore((state) => state.tableName) as string;
  if (tableName) {
    const result = useQuery({
      queryKey: ["read_parquet", tableName, perPage, page],
      queryFn: async () => {
        console.log(tableName, page, perPage);
        return await read_parquet(tableName, {
          limit: perPage,
          offset: (page - 1) * perPage,
        });
      },
    });

    return result;
  }
  return;
};
