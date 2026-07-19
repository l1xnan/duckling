import { Data, Table, tableFromIPC } from '@apache-arrow/ts';
import { invoke } from '@tauri-apps/api/core';
import { Update } from '@tauri-apps/plugin-updater';
import { uniqBy } from 'es-toolkit';
import { nanoid } from 'nanoid';

import {
  flattenSshTunnelForBackend,
  pickSecrets,
  stripSecrets,
} from '@/lib/connectionConfig';
import type { DialectRef } from '@/lib/connectionRef';
import { registerConnectionBackend } from '@/lib/connectionRef';
import { ArrowResponse, SchemaType } from '@/stores/dataset';
import { DBType, DialectConfig } from '@/stores/dbList';
import { UpdaterSource } from '@/stores/setting';

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
    return value.toString();
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
  dialect?: DialectRef;
  /** When set, backend registers an inflight token; call `cancelQuery` with the same id. */
  requestId?: string;
};

export type QueryTableParams = {
  table: string;
  limit: number;
  offset: number;
  where?: string;
  orderBy?: string;
  dialect?: DialectRef;
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

/** Cancel an in-flight query previously started with `requestId`. */
export async function cancelQuery(requestId: string): Promise<boolean> {
  return invoke<boolean>('cancel_query', { requestId });
}

export type CapabilitiesResponse = {
  dialect: string;
  capabilities: string[];
};

/** Capability flags for UI gating (export / find / drop_table / …). */
export async function connectionCapabilities(
  dialect: DialectRef | { dialect: string },
): Promise<CapabilitiesResponse> {
  return invoke<CapabilitiesResponse>('connection_capabilities', { dialect });
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
  console.debug('params:', params);
  const dialect =
    params.dialect ??
    (params.dbId ? { connectionId: params.dbId } : undefined);
  await invoke('export', {
    ...params,
    dialect,
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
      acc[database] ??= {};
      acc[database][table] ??= [];
      const _columns = columns.map(([name, type]) => ({ name, type }));
      acc[database][table].push(..._columns);
      return acc;
    },
    {} as Record<string, Record<string, { name: string; type: string }[]>>,
  );
};

/**
 * Lightweight connectivity check (does not load full schema for SQL dialects).
 * - With `connectionId`: re-register form profile so vault can fill empty secrets, then test by id.
 * - Without id: send ad-hoc flattened config (must include credentials from the form).
 */
export async function testConnection(
  config: DialectConfig,
  options?: { connectionId?: string },
): Promise<void> {
  if (options?.connectionId) {
    await registerConnectionBackend(
      options.connectionId,
      config,
      pickSecrets(config),
    );
    await invoke('test_connection', {
      dialect: { connectionId: options.connectionId },
    });
    return;
  }
  await invoke('test_connection', {
    dialect: flattenSshTunnelForBackend(config),
  });
}

/**
 * Open / refresh a connection.
 * - With `connectionId`: backend loads credentials from registry (password not needed from UI).
 * - Without id: ad-hoc payload (first open); caller should register afterward.
 */
export async function getDB(
  dialect: DialectConfig | DialectRef,
  connectionId?: string,
): Promise<DBType> {
  const id =
    connectionId ??
    ('connectionId' in dialect && dialect.connectionId
      ? dialect.connectionId
      : nanoid());

  // Ensure backend registry has this connection before querying by id-only.
  if (!('connectionId' in dialect && dialect.connectionId) && !connectionId) {
    // First-time open: send full config once, then register for subsequent calls.
    const full = dialect as DialectConfig;
    // Backend DialectPayload expects flat `ssh_*` fields.
    const backendDialect = flattenSshTunnelForBackend(full);
    const tree: TreeNode = await invoke('get_db', { dialect: backendDialect });
    const colMeta: MetadataType[] = await invoke('all_columns', {
      dialect: backendDialect,
    });
    await registerConnectionBackend(id, full);

    let defaultDatabase = '';
    if (uniqBy(colMeta, (item) => item.database).length == 1) {
      defaultDatabase = colMeta[0].database;
    }
    const meta = convertMeta(colMeta);
    return {
      id,
      dialect: full.dialect,
      data: tree,
      // Never return plaintext secrets to frontend state.
      config: stripSecrets(full),
      meta,
      displayName: tree.name,
      defaultDatabase,
    };
  }

  const ref: DialectRef = { connectionId: id };
  const tree: TreeNode = await invoke('get_db', { dialect: ref });
  const colMeta: MetadataType[] = await invoke('all_columns', {
    dialect: ref,
  });

  let defaultDatabase = '';
  if (uniqBy(colMeta, (item) => item.database).length == 1) {
    defaultDatabase = colMeta[0].database;
  }
  const meta = convertMeta(colMeta);
  const dialectName =
    'dialect' in dialect && dialect.dialect
      ? (dialect.dialect as DBType['dialect'])
      : 'duckdb';
  return {
    id,
    dialect: dialectName,
    data: tree,
    config:
      'dialect' in dialect
        ? stripSecrets(dialect as DialectConfig)
        : undefined,
    meta,
    displayName: tree.name,
    defaultDatabase,
  };
}

export async function showSchema(
  schema: string,
  dialect: DialectRef,
): Promise<ResultType> {
  const res = await invoke('show_schema', { schema, dialect });
  return convert(res as ArrowResponse);
}

export async function showColumns(
  table: string,
  dialect: DialectRef,
): Promise<ResultType> {
  const res = await invoke('show_column', { table, dialect });
  return convert(res as ArrowResponse);
}

export async function dropTable(
  table: string,
  dialect: DialectRef,
): Promise<ResultType> {
  const res = await invoke('drop_table', { table, dialect });
  return convert(res as ArrowResponse);
}

export async function formatSQL(sql: string): Promise<string> {
  const res = await invoke<string>('format_sql', { sql });
  return res;
}

export type SqlfmtCheckResult = {
  available: boolean;
  path: string;
  version: string | null;
  error: string | null;
};

export async function checkSqlfmt(
  path?: string | null,
): Promise<SqlfmtCheckResult> {
  return invoke<SqlfmtCheckResult>('check_sqlfmt', {
    path: path?.trim() ? path.trim() : null,
  });
}

export async function formatSqlWithSqlfmt(
  sql: string,
  options?: {
    path?: string | null;
    lineLength?: number | null;
    dialect?: string | null;
  } | null,
): Promise<string> {
  return invoke<string>('format_sql_sqlfmt', {
    sql,
    path: options?.path?.trim() ? options.path.trim() : null,
    line_length: options?.lineLength ?? null,
    dialect:
      options?.dialect && options.dialect !== 'polyglot'
        ? options.dialect
        : null,
  });
}

export async function find(
  value: string,
  path: string,
  dialect: DialectRef,
): Promise<ResultType> {
  const res = await invoke('find', { value, path, dialect });
  return convert(res as ArrowResponse);
}

export async function openPath(path: string): Promise<string> {
  const res = await invoke<string>('open_path', { path });
  return res;
}

/** Open the app data folder that contains local config (e.g. settings.json). */
export async function openSettingsDir(): Promise<string> {
  return invoke<string>('open_settings_dir');
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

export async function writeTextFile(
  path: string,
  contents: string,
): Promise<void> {
  await invoke('write_text_file', { path, contents });
}

export type ConnectionSecretsDto = {
  password?: string;
  ssh_password?: string;
  ssh_passphrase?: string;
  token?: string;
};

export type ConnectionProfileDto = {
  id: string;
  displayName: string;
  dialect: string;
  config?: unknown;
  createdAt?: number;
  updatedAt?: number;
};

export type ConnectionsExportDto = {
  format: string;
  version: number;
  exportedAt: string;
  includeSecrets: boolean;
  connections: ConnectionProfileDto[];
  kdf?: string;
  crypto?: string;
  salt?: string;
  nonce?: string;
  secretsBlob?: string;
};

export async function connectionsExportEncrypt(
  connections: ConnectionProfileDto[],
  secretsById: Record<string, ConnectionSecretsDto>,
  password: string,
): Promise<ConnectionsExportDto> {
  return invoke<ConnectionsExportDto>('connections_export_encrypt', {
    connections,
    secretsById,
    password,
  });
}

export async function connectionsImportDecrypt(
  file: ConnectionsExportDto,
  password: string,
): Promise<Record<string, ConnectionSecretsDto>> {
  return invoke<Record<string, ConnectionSecretsDto>>(
    'connections_import_decrypt',
    { file, password },
  );
}

/** Unique font family names installed on the system. */
export async function listSystemFonts(): Promise<string[]> {
  return invoke<string[]>('list_system_fonts');
}

type AppUpdateMetadata = {
  rid: number;
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
  rawJson: Record<string, unknown>;
};

export async function checkAppUpdate(options?: {
  source?: UpdaterSource | null;
  proxy?: string | null;
}): Promise<Update | null> {
  const metadata = await invoke<AppUpdateMetadata | null>('check_app_update', {
    source: options?.source ?? 'official',
    proxy: options?.proxy?.trim() ? options.proxy.trim() : null,
  });
  return metadata ? new Update(metadata) : null;
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
