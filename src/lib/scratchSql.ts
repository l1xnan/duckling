import { nanoid } from 'nanoid';

import {
  deleteScratchSql,
  getScratchDir,
  listScratchSql,
  readScratchSql,
  writeScratchSql,
  type ScratchSqlEntry,
} from '@/api';
import type { EditorContextType } from '@/stores/tabs';

let cachedScratchDir: string | null = null;

const pendingWrites = new Map<string, string>();
const writeTimers = new Map<string, ReturnType<typeof setTimeout>>();

const WRITE_DELAY_MS = 300;

function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

export async function resolveScratchDir(): Promise<string> {
  if (cachedScratchDir) {
    return cachedScratchDir;
  }
  if (!isTauriRuntime()) {
    cachedScratchDir = 'scratch';
    return cachedScratchDir;
  }
  const dir = normalizePath(await getScratchDir());
  cachedScratchDir = dir;
  return dir;
}

export function getCachedScratchDir(): string | null {
  return cachedScratchDir;
}

export function isScratchPath(
  path: string | undefined | null,
  scratchDir?: string | null,
): boolean {
  if (!path) {
    return false;
  }
  const dir = normalizePath(scratchDir ?? cachedScratchDir ?? '');
  if (!dir) {
    return false;
  }
  const p = normalizePath(path);
  return p === dir || p.startsWith(`${dir}/`);
}

export function scratchIdFromPath(path: string): string | null {
  const p = normalizePath(path);
  const base = p.split('/').pop() ?? '';
  if (!base.toLowerCase().endsWith('.sql')) {
    return null;
  }
  return base.slice(0, -4) || null;
}

export async function writeScratch(id: string, contents: string): Promise<string> {
  if (!isTauriRuntime()) {
    const dir = await resolveScratchDir();
    return `${dir}/${id}.sql`;
  }
  return normalizePath(await writeScratchSql(id, contents));
}

export async function readScratch(id: string): Promise<string> {
  if (!isTauriRuntime()) {
    return '';
  }
  return readScratchSql(id);
}

export async function removeScratch(id: string): Promise<void> {
  clearScheduledWrite(id);
  pendingWrites.delete(id);
  if (!isTauriRuntime()) {
    return;
  }
  await deleteScratchSql(id);
}

export async function listScratch(): Promise<ScratchSqlEntry[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  const entries = await listScratchSql();
  return entries.map((e) => ({
    ...e,
    path: normalizePath(e.path),
  }));
}

function clearScheduledWrite(id: string) {
  const timer = writeTimers.get(id);
  if (timer != null) {
    clearTimeout(timer);
    writeTimers.delete(id);
  }
}

/** Debounced disk write for scratch SQL content. */
export function scheduleWriteScratch(id: string, contents: string) {
  pendingWrites.set(id, contents);
  clearScheduledWrite(id);
  const timer = setTimeout(() => {
    writeTimers.delete(id);
    const next = pendingWrites.get(id);
    if (next === undefined) {
      return;
    }
    pendingWrites.delete(id);
    void writeScratch(id, next).catch((err) => {
      console.warn('write scratch sql failed', id, err);
    });
  }, WRITE_DELAY_MS);
  writeTimers.set(id, timer);
}

/** Flush any pending debounced write immediately. */
export async function flushWriteScratch(id: string): Promise<void> {
  clearScheduledWrite(id);
  const next = pendingWrites.get(id);
  if (next === undefined) {
    return;
  }
  pendingWrites.delete(id);
  await writeScratch(id, next);
}

export type CreateScratchOptions = {
  dbId: string;
  displayName: string;
  schema?: string;
  tableId?: string;
  /** Initial SQL body (written to disk). */
  content?: string;
  id?: string;
};

/**
 * Create a scratch editor tab bound to `{app_data}/scratch/{id}.sql`.
 * Returns tab + content for callers to set docs / append tab.
 */
export async function createScratchEditor(
  options: CreateScratchOptions,
): Promise<{ tab: EditorContextType; content: string }> {
  const id = options.id ?? nanoid();
  const content = options.content ?? '';
  const path = await writeScratch(id, content);
  const tab: EditorContextType = {
    id,
    dbId: options.dbId,
    displayName: options.displayName,
    type: 'editor',
    path,
    schema: options.schema,
    tableId: options.tableId,
  };
  return { tab, content };
}

/** Persist content when filling an existing editor that may be a scratch file. */
export function persistEditorContent(
  tab: { id: string; path?: string },
  content: string,
  scratchDir?: string | null,
) {
  if (isScratchPath(tab.path, scratchDir)) {
    scheduleWriteScratch(tab.id, content);
  }
}
