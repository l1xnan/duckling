import type { TreeNode } from '@/types';

import { indexDBStorage } from './indexdb';

export type DbCacheEntry = {
  data: TreeNode;
  meta?: Record<string, Record<string, { name: string; type: string }[]>>;
  defaultDatabase?: string;
  defaultSchema?: string;
  cachedAt: number;
};

function cacheKey(connectionId: string): string {
  return `dbCache:${connectionId}`;
}

export async function getDbCache(
  connectionId: string,
): Promise<DbCacheEntry | null> {
  try {
    const raw = await indexDBStorage.getItem(cacheKey(connectionId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as DbCacheEntry;
  } catch {
    return null;
  }
}

export async function setDbCache(
  connectionId: string,
  entry: Omit<DbCacheEntry, 'cachedAt'> & { cachedAt?: number },
): Promise<void> {
  const value: DbCacheEntry = {
    data: entry.data,
    meta: entry.meta,
    defaultDatabase: entry.defaultDatabase,
    defaultSchema: entry.defaultSchema,
    cachedAt: entry.cachedAt ?? Date.now(),
  };
  await indexDBStorage.setItem(cacheKey(connectionId), JSON.stringify(value));
}

export async function deleteDbCache(connectionId: string): Promise<void> {
  await indexDBStorage.removeItem(cacheKey(connectionId));
}

export async function loadDbCaches(
  connectionIds: string[],
): Promise<Map<string, DbCacheEntry>> {
  const map = new Map<string, DbCacheEntry>();
  await Promise.all(
    connectionIds.map(async (id) => {
      const entry = await getDbCache(id);
      if (entry) {
        map.set(id, entry);
      }
    }),
  );
  return map;
}
