import { Table, tableFromIPC } from '@apache-arrow/ts';
import { invoke } from '@tauri-apps/api/core';
import { nanoid } from 'nanoid';

import { ArrowResponse, SchemaType } from '@/stores/dataset';
import { DBType, DialectConfig } from '@/stores/dbList';

import { TreeNode } from './types';

export type TitleType = {
  name: string;
  type: string;
};

export type ResultType<T = unknown> = {
  total: number;
  data: T[];
  tableSchema: SchemaType[];
  code: number;
  sql?: string;
  message: string;
};

export function convertArrow(arrowData: Array<number>, titles?: TitleType[]) {
  const table: Table = tableFromIPC(Uint8Array.from(arrowData));
  const tableSchema: SchemaType[] = table.schema.fields.map((field, i) => {
    return {
      name: field.name,
      dataType: field.type,
      nullable: field.nullable,
      metadata: field.metadata,
      type: titles?.[i]?.type ?? field.type,
    };
  });

  const data = table.toArray().map((item) => item.toJSON());

  console.table([...data.slice(0, 10)]);
  console.table(tableSchema);
  return {
    data,
    tableSchema,
  };
}

function convert(res: ArrowResponse): ResultType {
  const { data, titles, sql, total, code, message } = res;
  if (code === 0) {
    return {
      ...convertArrow(data, titles),
      total: total ?? data.length,
      code,
      sql,
      message,
    };
  }
  return {
    data: [],
    tableSchema: [],
    total: 0,
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
  console.debug('query sql params:', params);
  const res = await invoke<ArrowResponse>('query', params);
  return convert(res);
}

export async function pagingQuery(params: QueryParams): Promise<ResultType> {
  console.debug('query sql params:', params);
  const res = await invoke<ArrowResponse>('paging_query', params);
  return convert(res);
}

export async function queryTable(
  params: QueryTableParams,
): Promise<ResultType> {
  console.debug('query table params:', params);
  const res = await invoke<ArrowResponse>('query_table', params);
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

export async function getDB(option: DialectConfig): Promise<DBType> {
  const tree: TreeNode = await invoke('get_db', { dialect: option });
  console.log('tree:', tree);
  return {
    id: nanoid(),
    dialect: option.dialect,
    data: tree,
    config: option,
    displayName: tree.name,
  };
}

export async function showSchema(
  schema: string,
  dialect: DialectConfig,
): Promise<ResultType> {
  const res = await invoke('show_schema', { schema, dialect });
  return convert(res as ArrowResponse);
}

export async function showColumns(
  table: string,
  dialect: DialectConfig,
): Promise<ResultType> {
  console.log(table, dialect);
  const res = await invoke('show_column', { table, dialect });
  return convert(res as ArrowResponse);
}

export async function dropTable(
  table: string,
  dialect: DialectConfig,
): Promise<ResultType> {
  console.log(table, dialect);
  const res = await invoke('drop_table', { table, dialect });
  return convert(res as ArrowResponse);
}

export async function formatSQL(sql: string): Promise<string> {
  const res = await invoke('format_sql', { sql });
  console.log('format sql:', res);
  return res;
}

export class Connection {
  db: unknown;

  constructor(db: unknown) {
    this.db = db;
  }

  getTables() {}

  showColumns() {}

  dropTable() {}

  execute() {}

  query() {}
}
