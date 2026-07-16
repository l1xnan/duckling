import { Data, Table, tableFromIPC } from '@apache-arrow/ts';
import { invoke } from '@tauri-apps/api/core';
import { uniqBy } from 'es-toolkit';
import { nanoid } from 'nanoid';

import { ArrowResponse, SchemaType } from '@/stores/dataset';
import { DBType, DialectConfig } from '@/stores/dbList';
import { getDatabase } from '@/stores/tabs';

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

function bigIntReplacer(_key: string, value: any) {
  if (typeof value === 'bigint') {
    return value.toString(); // 将 BigInt 转换为字符串
  }
  return value;
}

export function arrowToJSON(value: Data, space = 2) {
  try {
    return JSON.stringify(value, bigIntReplacer, space);
  } catch {
    return value.toString();
  }
}

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

  console.table(data.slice(0, 10));
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

export type ExportFormat = 'csv' | 'tsv' | 'json' | 'parquet' | 'xlsx';

export type ExportOptions = {
  header?: boolean;
  delimiter?: string;
  quote?: string;
  compression?: string;
  compression_level?: number;
  json_array?: boolean;
};

export async function exportCsv(
  params: QueryParams & {
    file: string;
    format?: ExportFormat;
    options?: ExportOptions;
    dbId?: string;
  },
): Promise<void> {
  const db = getDatabase(params.dbId ?? '');
  console.debug('params:', params);
  await invoke('export', {
    ...params,
    dialect: db?.config,
  });
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

export type SqlfmtCheckResult = {
  available: boolean;
  path: string;
  version: string | null;
  error: string | null;
};

/** Check whether the external `sqlfmt` (shandy-sqlfmt) binary is available. */
export async function checkSqlfmt(path?: string | null): Promise<SqlfmtCheckResult> {
  return invoke<SqlfmtCheckResult>('check_sqlfmt', {
    path: path?.trim() ? path.trim() : null,
  });
}

/** Format SQL via external `sqlfmt` (`sqlfmt -` over stdin). */
export async function formatSqlWithSqlfmt(
  sql: string,
  path?: string | null,
): Promise<string> {
  return invoke<string>('format_sql_sqlfmt', {
    sql,
    path: path?.trim() ? path.trim() : null,
  });
}

export async function find(
  value: string,
  path: string,
  dialect: DialectConfig,
): Promise<ResultType> {
  const res = await invoke('find', { value, path, dialect });
  return convert(res as ArrowResponse);
}

export async function openPath(path: string): Promise<string> {
  const res = await invoke<string>('open_path', { path });
  console.log('open path:', path);
  return res;
}

export type SshConfigHost = {
  alias: string;
  host: string;
  port: number;
  username?: string;
  identity_file?: string;
  label: string;
};

export async function listSshConfigHosts(): Promise<SshConfigHost[]> {
  return invoke<SshConfigHost[]>('list_ssh_config_hosts');
}

export async function listSqlDir(path: string): Promise<TreeNode> {
  return invoke<TreeNode>('list_sql_dir', { path });
}

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>('read_text_file', { path });
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
