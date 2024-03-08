import { Table, tableFromIPC } from '@apache-arrow/ts';
import { invoke } from '@tauri-apps/api/core';
import { nanoid } from 'nanoid';

import { DBType, DialectConfig } from '@/stores/dbList';

import { ArrowResponse, SchemaType } from './stores/dataset';
import { TreeNode } from './types';

export type TitleType = {
  name: string;
  type: string;
};

export type ResultType<T = unknown> = {
  totalCount: number;
  data: T[];
  schema: SchemaType[];
  titles?: TitleType[];
  code: number;
  message: string;
};

export type OptionType = {
  limit: number;
  offset: number;
  order?: string;
};

export function convertArrow(
  arrowData: Array<number>,
  totalCount: number,
  titles?: TitleType[],
) {
  const table: Table = tableFromIPC(Uint8Array.from(arrowData));
  const schema: SchemaType[] = table.schema.fields.map((field: any, i) => {
    return {
      name: field.name,
      dataType: field.type.toString(),
      nullable: field.nullable,
      metadata: field.metadata,
      type: titles?.[i]?.type ?? field.type,
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
  const { data, titles, total, code, message } = res;
  if (code === 0) {
    return {
      ...convertArrow(data, total, titles),
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

export type QueryParams = {
  sql: string;
  limit: number;
  offset: number;
  dialect?: DialectConfig;
};

export type QueryTableParams = {
  table: string;
  limit: number;
  offset: number;
  where?: string;
  orderBy?: string;
  dialect?: DialectConfig;
};

export async function query(params: QueryParams): Promise<ResultType> {
  console.debug('params:', params);
  const res = await invoke<ArrowResponse>('query', params);
  console.log(res);

  return convert(res);
}

export async function queryTable(
  params: QueryTableParams,
): Promise<ResultType> {
  console.debug('query table params:', params);
  const res = await invoke<ArrowResponse>('query_table', params);
  console.log(res);

  return convert(res);
}

export async function exportCsv(
  params: QueryParams & { file: string },
): Promise<ResultType> {
  console.debug('params:', params);
  const res = await invoke<ArrowResponse>('export', params);
  console.log(res);

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

export async function getDB(option: DialectConfig): Promise<DBType> {
  const tree: TreeNode = await invoke('get_db', option);
  console.log('tree:', tree);
  return {
    id: nanoid(),
    dialect: option.dialect,
    data: tree,
    config: option,
    displayName: tree.name,
  };
}
