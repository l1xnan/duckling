import { Table, tableFromIPC } from '@apache-arrow/ts';
import { invoke } from '@tauri-apps/api/primitives';

import { FileNode } from '@/stores/db';

import { ArrowResponse, SchemaType } from './stores/store';

export type ResultType = {
  totalCount: number;
  data: any[];
  schema: SchemaType[];
  code: number;
  message: string;
};

export type OptionType = {
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
  const res = await invoke<ArrowResponse>('show_tables', { path });
  return convert(res);
}

export type QueryParams = {
  path: string;
  sql: string;
  limit: number;
  offset: number;
  cwd?: string;
};

export async function query(params: QueryParams): Promise<ResultType> {
  const res = await invoke<ArrowResponse>('query', params);
  return convert(res);
}

export async function read_parquet(
  path: string,
  { limit = 500, offset = 0, order }: OptionType,
): Promise<ResultType> {
  const res = await invoke<ArrowResponse>('read_parquet', {
    path,
    limit,
    offset,
    order,
  });
  return convert(res);
}

export async function getFolderTree(name: string): Promise<FileNode> {
  const fileTree: FileNode = await invoke('get_folder_tree', { name });
  return fileTree;
}
