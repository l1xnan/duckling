import { Table, tableFromIPC } from '@apache-arrow/ts';
import { invoke } from '@tauri-apps/api/core';
import { nanoid } from 'nanoid';

import { ArrowResponse, SchemaType } from '@/stores/dataset';
import { DBType, DialectConfig } from '@/stores/dbList';
import { getDatabase } from '@/stores/tabs';
import { uniqBy } from 'es-toolkit';
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
  elapsed?: number;
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
  const { data, titles, sql, total, code, message, elapsed } = res;
  if (code === 0) {
    return {
      ...convertArrow(data, titles),
      total: total ?? data.length,
      code,
      sql,
      elapsed,
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
  params: QueryParams & {
    file: string;
    format: 'csv' | 'parquet';
    dbId?: string;
  },
): Promise<ResultType> {
  const db = getDatabase(params.dbId ?? '');
  console.debug('params:', params);
  const res = await invoke<ArrowResponse>('export', {
    ...params,
    dialect: db?.config,
  });
  console.log(res);
}

export type MetadataType = {
  database: string;
  table: string;
  columns: [string, string][];
};

const convertMeta = (data: MetadataType[]) => {
  return data.reduce(
    (acc, { database, table, columns }) => {
      // 初始化 database 层级
      acc[database] ??= {}; // 使用逻辑空赋值简化代码
      // 初始化 table 层级
      acc[database][table] ??= [];
      // 添加 column 到数组
      const _columns = columns.map(([name, type]) => ({ name, type }));
      acc[database][table].push(..._columns);
      return acc;
    },
    {} as Record<string, Record<string, { name: string; type: string }[]>>,
  );
};

export async function getDB(dialect: DialectConfig): Promise<DBType> {
  const tree: TreeNode = await invoke('get_db', { dialect });
  const colMeta: MetadataType[] = await invoke('all_columns', {
    dialect,
  });

  let defaultDatabase = '';
  if (uniqBy(colMeta, (item) => item.database).length == 1) {
    defaultDatabase = colMeta[0].database;
  }
  const meta = convertMeta(colMeta);
  console.log('tree:', tree, colMeta, meta);
  return {
    id: nanoid(),
    dialect: dialect.dialect,
    data: tree,
    config: dialect,
    meta,
    displayName: tree.name,
    defaultDatabase,
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
  const res = await invoke<string>('format_sql', { sql });
  console.log('format sql:', res);
  return res;
}

export async function find(
  value: string,
  path: string,
  dialect: DialectConfig,
): Promise<ResultType> {
  const res = await invoke('find', { value, path, dialect });
  return convert(res as ArrowResponse);
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
