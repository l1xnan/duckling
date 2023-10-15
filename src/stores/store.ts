import { Table, tableFromIPC } from "@apache-arrow/ts";
import { invoke } from "@tauri-apps/api/tauri";
import { create } from "zustand";

export type SchemaType = {
  name: string;
  dataType: string;
  type: any;
  nullable: boolean;
  metadata: any;
};

export interface DatasetState {
  page: number;
  totalCount: number;
  data: any[];
  perPage: number;
  tableName?: string;
  schema: SchemaType[];
  setData?: (res: ResultType) => void;
  increase: () => void;
  toFirst: () => void;
  setTableName: (tableName: string) => void;
  decrease: () => void;
}

export const useStore = create<DatasetState>((set) => ({
  page: 1,
  perPage: 500,
  tableName: undefined,
  totalCount: 0,
  schema: [],
  data: [],
  setData: (res: { totalCount: number; data: any[]; schema: SchemaType[] }) =>
    set((_) => res),
  increase: () => set((state) => ({ page: state.page + 1 })),
  toFirst: () => set((_) => ({ page: 1 })),
  setTableName: (tableName: string) => set((_) => ({ tableName })),
  decrease: () => set((state) => ({ page: state.page - 1 })),
}));

interface ValidationResponse {
  row_count: number;
  total_count: number;
  preview: Array<number>;
}

type ResultType = { totalCount: number; data: any[]; schema: SchemaType[] };

export async function read_parquet(path: string): Promise<ResultType> {
  const { row_count, preview, total_count }: ValidationResponse = await invoke(
    "read_parquet",
    { path, limit: 500, offset: 0 }
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
