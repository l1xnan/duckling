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

interface ArrowResponse {
  total: number;
  data: Array<number>;
  code: number;
  message: string;
}

export type DTableType = {
  rootKey: number;
  root: string;
  tableName: string;
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
};

export interface DatasetState extends DatasetField {
  setStore?: (res: Partial<DatasetField>) => void;
  setOrderBy?: (name: string) => void;
  increase: () => void;
  toFirst: () => void;
  toLast: () => void;
  setTableName: (tableName: string) => void;
  decrease: () => void;
  setSQLWhere: (value: string) => void;
  refresh: () => Promise<void>;
}

type OrderByType = {
  name: string;
  desc: boolean;
};

type StmtType = {
  tableName: string;
  page?: number;
  perPage?: number;
  orderBy?: OrderByType;
  where?: string;
};

export function convertOrderBy({ name, desc }: OrderByType) {
  if (!name) {
    return undefined;
  }
  return `${name} ${desc ? "DESC" : ""}`;
}

function genStmt({ tableName, orderBy, where }: StmtType) {
  let stmt = `select * from ${tableName}`;
  if (!!where && where.length > 0) {
    stmt = `${stmt} where ${where}`;
  }
  if (!!orderBy && orderBy.name) {
    stmt = `${stmt} order by ${convertOrderBy(orderBy)}`;
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
  sqlWhere: undefined,
  code: 0,
  message: undefined,
  setStore: (res: object) => set((_) => res),
  increase: () => set((state) => ({ page: state.page + 1 })),
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
  setTableName: (tableName: string) => set((_) => ({ tableName })),
  decrease: () => set((state) => ({ page: state.page - 1 })),
  refresh: async () => {
    const page = get().page;
    const perPage = get().perPage;
    const table = get().table;
    const sqlWhere = get().sqlWhere;
    if (!table || !table.tableName) {
      return;
    }

    let path = ":memory:";
    let tableName = table.tableName;

    if (table?.root?.endsWith(".duckdb")) {
      path = table.root;
    } else if (table?.root?.endsWith(".csv")) {
      tableName = `read_csv('${table.tableName}')`;
    } else if (table?.root?.endsWith(".parquet")) {
      tableName = `read_parquet('${table.tableName}')`;
    }
    const sql = genStmt({
      tableName,
      orderBy: get().orderBy,
      where: sqlWhere,
    });

    console.log("query:", path, sql);
    const data = await query(path, sql, perPage, (page - 1) * perPage);
    console.log(data);
    set({ ...data });
  },
}));

type ResultType = {
  totalCount: number;
  data: any[];
  schema: SchemaType[];
  code: number;
  message: string;
};

type OptionType = {
  limit: number;
  offset: number;
  order?: string;
};

export function convertArrow(arrowData: Array<number>, totalCount: number) {
  const table: Table = tableFromIPC(Uint8Array.from(arrowData));
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

function convert(res: ArrowResponse): ResultType {
  const { data, total, code, message } = res;
  if (code === 0) {
    return {
      ...convertArrow(data, total),
      code,
      message,
    };
  }
  return {
    data: [],
    schema: [],
    totalCount: 0,
    code,
    message,
  };
}

export async function showTables(path?: string) {
  const res = await invoke<ArrowResponse>("show_tables", { path });
  return convert(res);
}

export async function query(
  path: string,
  sql: string,
  limit: number,
  offset: number
): Promise<ResultType> {
  const res = await invoke<ArrowResponse>("query", {
    path,
    sql,
    limit,
    offset,
  });
  return convert(res);
}

export async function read_parquet(
  path: string,
  { limit = 500, offset = 0, order }: OptionType
): Promise<ResultType> {
  const res = await invoke<ArrowResponse>("read_parquet", {
    path,
    limit,
    offset,
    order,
  });
  return convert(res);
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
