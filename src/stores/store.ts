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
  setStore?: (res: object) => void;
  increase: () => void;
  toFirst: () => void;
  toLast: () => void;
  setTableName: (tableName: string) => void;
  decrease: () => void;
  refresh: () => Promise<void>;
}

export const useStore = create<DatasetState>((set, get) => ({
  page: 1,
  perPage: 500,
  tableName: undefined,
  totalCount: 0,
  schema: [],
  data: [],
  setStore: (res: object) => set((_) => res),
  increase: () => set((state) => ({ page: state.page + 1 })),
  toFirst: () => set((_) => ({ page: 1 })),
  toLast: () =>
    set((state) => {
      console.log(Math.ceil(state.totalCount / state.perPage));
      return { page: Math.ceil(state.totalCount / state.perPage) };
    }),
  setTableName: (tableName: string) => set((_) => ({ tableName })),
  decrease: () => set((state) => ({ page: state.page - 1 })),
  refresh: async () => {
    const page = get().page;
    const perPage = get().perPage;
    const tableName = get().tableName;
    console.log(tableName, page, perPage);
    if (!!tableName) {
      const data = await read_parquet(tableName, perPage, (page - 1) * perPage);

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

export async function read_parquet(
  path: string,
  limit: number = 500,
  offset: number = 0
): Promise<ResultType> {
  console.log(path);
  const { row_count, preview, total_count }: ValidationResponse = await invoke(
    "read_parquet",
    { path, limit, offset }
  );
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

  console.log(row_count, table);
  console.table([...data.slice(0, 10)]);
  console.table(schema);
  return {
    totalCount: total_count,
    data,
    schema,
  };
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
        return await read_parquet(tableName, perPage, (page - 1) * perPage);
      },
    });

    return result;
  }
  return;
};

export const readCurParquet = async () => {
  const page = useStore((state) => state.page);
  const perPage = useStore((state) => state.perPage);
  const tableName = useStore((state) => state.tableName) as string;
  console.log(tableName, page, perPage);
  const data = await read_parquet(tableName, perPage, (page - 1) * perPage);
  return data;
};
