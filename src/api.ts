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
  const { data, titles, total, code, message } = res;
  if (code === 0) {
    return {
      ...convertArrow(data, total),
      titles,
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

type DBInfoType = ResultType<{
  table_name: string;
  table_type: string;
}>;

export async function showTables(path?: string): Promise<DBInfoType> {
  const res = await invoke<ArrowResponse>('show_tables', { path });
  return convert(res) as DBInfoType;
}

export type QueryParams = {
  sql: string;
  limit: number;
  offset: number;
  dialect?: DialectConfig;
};

export async function query(params: QueryParams): Promise<ResultType> {
  console.debug('params:', params);
  const res = await invoke<ArrowResponse>('query', params);
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

export async function getDBTree(root: string) {
  const res = await showTables(root);

  const views: TreeNode[] = [];
  const tables: TreeNode[] = [];

  res.data.forEach(({ table_name, table_type }) => {
    const item = {
      name: table_name,
      path: table_name,
      type: table_type == 'VIEW' ? 'view' : 'table',
      is_dir: false,
    };
    if (table_type == 'VIEW') {
      views.push(item);
    } else {
      tables.push(item);
    }
  });

  const data = {
    path: root,
    children: [
      {
        name: 'tables',
        path: 'tables',
        type: 'path',
        is_dir: true,
        children: tables,
      },
      {
        name: 'views',
        path: 'views',
        type: 'path',
        is_dir: true,
        children: views,
      },
    ],
  };
  return data;
}
