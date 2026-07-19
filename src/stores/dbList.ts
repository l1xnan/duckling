import { derive } from 'derive-zustand';
import { toast } from 'sonner';
import { create, useStore } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getDB } from '@/api';
import {
  normalizeDialectConfig,
  pickSecrets,
  stripSecrets,
  type ConnectionSecrets,
} from '@/lib/connectionConfig';
import {
  registerConnectionBackend,
  syncConnectionsBackend,
  unregisterConnectionBackend,
} from '@/lib/connectionRef';
import { TreeNode } from '@/types';

import { deleteDbCache, loadDbCaches, setDbCache } from './dbCache';
import { indexDBStorage } from './indexdb';
import { setConnectionSecrets } from './secretStore';
import { connectionsFileStorage } from './tauriStore';

export type NodeContextType = {
  id?: string;
  dbId: string;
  tableId: string;
  type?: string;
  extra?: unknown;
};

export type DialectType =
  | 'folder'
  | 'file'
  | 'duckdb'
  | 'quack'
  | 'clickhouse'
  | 'sqlite'
  | 'postgres'
  | 'mysql';

export type DuckdbConfig = {
  path: string;
  cwd?: string;
  dialect: DialectType;
};

export type FolderConfig = {
  path: string;
  cwd?: string;
  dialect: DialectType;
};
export type FileConfig = {
  dialect: 'file';
  path: string;
};

export type ClickhouseDialectType = {
  host: string;
  port: string;
  password: string;
  username: string;
  database: string;
  dialect: DialectType;
};

/** SSH tunnel entity (nested on network dialects; reusable as a standalone profile later). */
export type SshTunnelConfig = {
  enabled?: boolean;
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  private_key_path?: string;
  passphrase?: string;
  /** Alias from ~/.ssh/config when filled from config picker. */
  config_host?: string;
};

export type PostgresDialectType = {
  host: string;
  port: string;
  password: string;
  username: string;
  database: string;
  dialect: DialectType;
  ssh_tunnel?: SshTunnelConfig;
};

export type MySqlDialectType = {
  host: string;
  port: string;
  password: string;
  username: string;
  database: string;
  dialect: 'mysql';
  ssh_tunnel?: SshTunnelConfig;
};

export type QuackConfig = {
  uri: string;
  token?: string;
  disable_ssl?: boolean;
  dialect: 'quack';
};

export type DialectConfig =
  | DuckdbConfig
  | ClickhouseDialectType
  | FolderConfig
  | FileConfig
  | PostgresDialectType
  | MySqlDialectType
  | QuackConfig;

export type DBType = {
  id: string;
  dialect: DialectType;
  displayName: string;
  data: TreeNode;
  meta?: Record<string, Record<string, { name: string; type: string }[]>>;
  /** Non-secret connection profile only (passwords live in backend registry). */
  config?: DialectConfig;
  defaultDatabase?: string;
  defaultSchema?: string;
  loading?: boolean;
};

export type PersistedConnection = {
  id: string;
  dialect: DialectType;
  displayName: string;
  config?: DialectConfig;
};

type DBListState = {
  dbList: DBType[];
};

type DBListAction = {
  append: (db: DBType) => Promise<void>;
  update: (id: string, db: Partial<DBType>) => void;
  remove: (id: string) => void;
  rename: (id: string, displayName: string) => void;
  setCwd: (cwd: string, id: string) => Promise<void>;
  setDB: (
    id: string,
    config: DialectConfig,
    options?: { clearSecrets?: boolean },
  ) => Promise<void>;
  updateByConfig: (id: string, config: DialectConfig) => Promise<void>;
  importConnections: (
    items: Array<{
      id: string;
      displayName: string;
      dialect: DialectType;
      config: DialectConfig;
      secrets?: ConnectionSecrets;
    }>,
  ) => Promise<void>;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

type DBListStore = DBListState & DBListAction;

export function flattenTree(tree: TreeNode): Map<string, TreeNode> {
  const result: Map<string, TreeNode> = new Map();

  function flatten(node: TreeNode) {
    result.set(node.path, node);
    if (node.children && node.children.length > 0) {
      node.children.forEach(flatten);
    }
  }

  flatten(tree);
  return result;
}

function emptyTree(name = ''): TreeNode {
  return { name, path: name, children: [] };
}

/** Resolves when connections have been synced into the backend registry. */
let registryReadyResolve: (() => void) | null = null;
const registryReady = new Promise<void>((resolve) => {
  registryReadyResolve = resolve;
});
let registryReadyDone = false;

function markRegistryReady() {
  if (!registryReadyDone) {
    registryReadyDone = true;
    registryReadyResolve?.();
  }
}

export function whenRegistryReady(): Promise<void> {
  return registryReady;
}

if (typeof window !== 'undefined') {
  window.setTimeout(() => markRegistryReady(), 8000);
}

async function hydrateCaches(list: DBType[]): Promise<DBType[]> {
  const caches = await loadDbCaches(list.map((db) => db.id));
  return list.map((db) => {
    const cache = caches.get(db.id);
    if (!cache) {
      return db;
    }
    return {
      ...db,
      data: cache.data ?? db.data,
      meta: cache.meta ?? db.meta,
      defaultDatabase: cache.defaultDatabase ?? db.defaultDatabase,
      defaultSchema: cache.defaultSchema ?? db.defaultSchema,
    };
  });
}

type LegacyDbListPayload = {
  state?: { dbList?: DBType[] };
  dbList?: DBType[];
};

async function readLegacyDbList(): Promise<DBType[] | null> {
  try {
    const raw = await indexDBStorage.getItem('dbListStore');
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as LegacyDbListPayload;
    const legacyList = parsed.state?.dbList ?? parsed.dbList;
    if (!Array.isArray(legacyList) || legacyList.length === 0) {
      return null;
    }
    return legacyList;
  } catch (error) {
    console.warn('read legacy dbListStore failed', error);
    return null;
  }
}

async function migrateFromLegacyIndexedDb(): Promise<DBType[] | null> {
  try {
    const legacyList = await readLegacyDbList();
    if (!legacyList) {
      const raw = await indexDBStorage.getItem('dbListStore');
      if (raw) {
        await indexDBStorage.removeItem('dbListStore');
      }
      return null;
    }

    const migrated: DBType[] = [];
    for (const item of legacyList) {
      if (!item?.id) {
        continue;
      }
      const secrets = pickSecrets(item.config);
      // Register into backend (persists secrets + memory registry).
      await registerConnectionBackend(item.id, item.config, secrets);

      if (item.data && Object.keys(item.data).length > 0) {
        await setDbCache(item.id, {
          data: item.data,
          meta: item.meta,
          defaultDatabase: item.defaultDatabase,
          defaultSchema: item.defaultSchema,
        });
      }

      migrated.push({
        id: item.id,
        dialect: item.dialect,
        displayName: item.displayName,
        config: item.config
          ? stripSecrets(normalizeDialectConfig(item.config))
          : undefined,
        data: item.data ?? emptyTree(item.displayName),
        meta: item.meta,
        defaultDatabase: item.defaultDatabase,
        defaultSchema: item.defaultSchema,
      });
    }

    await indexDBStorage.removeItem('dbListStore');
    return migrated;
  } catch (error) {
    console.warn('legacy dbListStore migration failed', error);
    return null;
  }
}

/** Salvage secrets from legacy IDB into backend vault when profiles already exist. */
async function salvageSecretsFromLegacyIndexedDb(
  list: DBType[],
): Promise<void> {
  if (list.length === 0) {
    return;
  }
  const legacyList = await readLegacyDbList();
  if (!legacyList) {
    return;
  }
  const legacyById = new Map(
    legacyList.filter((item) => item?.id).map((item) => [item.id, item]),
  );

  let salvagedAny = false;
  for (const db of list) {
    const legacy = legacyById.get(db.id);
    const secrets = pickSecrets(legacy?.config);
    if (
      secrets.password ||
      secrets.ssh_password ||
      secrets.ssh_passphrase ||
      secrets.token
    ) {
      await setConnectionSecrets(db.id, secrets);
      salvagedAny = true;
    }
  }

  if (salvagedAny || legacyById.size === 0) {
    try {
      await indexDBStorage.removeItem('dbListStore');
    } catch {
      // ignore
    }
  }
}

export const useSelectedNodeStore = create<{
  selectedNode: NodeContextType | null;
  setSelectedNode: (n: NodeContextType | null) => void;
}>((set) => ({
  selectedNode: null,
  setSelectedNode: (selectedNode) => set({ selectedNode }),
}));

export const useDBListStore = create<DBListStore>()(
  persist(
    (set, get) => ({
      dbList: [],

      append: async (db) => {
        const secrets = pickSecrets(db.config);
        const profile = db.config
          ? stripSecrets(normalizeDialectConfig(db.config))
          : undefined;
        const entry: DBType = {
          ...db,
          config: profile,
          data: db.data ?? emptyTree(db.displayName),
        };
        try {
          // Register first so a failed backend never leaves a ghost list row.
          await registerConnectionBackend(db.id, profile, secrets);
        } catch (error) {
          console.warn('register_connection failed', error);
          toast.error(
            errorMessage(error, 'Failed to register connection'),
          );
          throw error;
        }
        set((state) => ({
          dbList: [...state.dbList, entry],
        }));
      },

      remove: (id) => {
        void unregisterConnectionBackend(id, true).catch((error) =>
          console.warn('unregister_connection failed', error),
        );
        void deleteDbCache(id);
        set((state) => ({
          dbList: state.dbList.filter((item) => item.id !== id),
        }));
        // Side effects after set — keep updater pure.
        const sel = useSelectedNodeStore.getState().selectedNode;
        if (sel?.dbId === id) {
          useSelectedNodeStore.getState().setSelectedNode(null);
        }
      },

      update: (id, { id: _id, ...db }) =>
        set((state) => ({
          dbList: state.dbList.map((item) =>
            item.id !== id ? item : { ...item, ...db },
          ),
        })),

      updateByConfig: async (id: string, config: DialectConfig) => {
        const updateDB = get().update;
        try {
          const normalized = normalizeDialectConfig(config);
          const secrets = pickSecrets(normalized);
          const profile = stripSecrets(normalized);
          // Always re-register full profile; backend vault fills empty secrets.
          await registerConnectionBackend(id, profile, secrets);
          updateDB(id, { loading: true, config: profile });
          // Query by connection id only — backend supplies credentials.
          const { data, meta, defaultDatabase } = await getDB(
            { connectionId: id },
            id,
          );
          updateDB(id, { data, meta, defaultDatabase, loading: false });
          await setDbCache(id, { data, meta, defaultDatabase });
        } catch (error) {
          console.error(error);
          toast.error(
            errorMessage(error, 'Failed to refresh connection'),
          );
        } finally {
          updateDB(id, { loading: false });
        }
      },

      setCwd: async (cwd: string, id: string) => {
        const item = get().dbList.find((db) => db.id === id);
        if (!item?.config) {
          return;
        }
        const nextConfig = { ...item.config, cwd } as DialectConfig;
        const profile = stripSecrets(nextConfig);
        set((state) => ({
          dbList: state.dbList.map((db) =>
            db.id === id ? { ...db, config: profile } : db,
          ),
        }));
        try {
          // cwd affects folder/duckdb backends — keep registry in sync.
          await registerConnectionBackend(id, profile, {});
        } catch (error) {
          console.warn('setCwd register failed', error);
          toast.error(
            errorMessage(error, 'Failed to update connection working directory'),
          );
        }
      },

      setDB: async (id, config, options) => {
        const normalized = normalizeDialectConfig(config);
        const profile = stripSecrets(normalized);
        // previous.config is already stripped — empty form fields rely on backend vault merge.
        const secrets = options?.clearSecrets ? {} : pickSecrets(normalized);
        try {
          await registerConnectionBackend(id, profile, secrets);
          set((state) => ({
            dbList: state.dbList.map((item) =>
              item.id == id ? { ...item, config: profile } : item,
            ),
          }));
          void deleteDbCache(id);
        } catch (error) {
          console.error(error);
          toast.error(
            errorMessage(error, 'Failed to save connection'),
          );
          throw error;
        }
      },

      rename: (dbId: string, displayName: string) => {
        set(({ dbList }) => ({
          dbList: dbList.map((item) => {
            return item.id == dbId
              ? {
                  ...item,
                  displayName,
                }
              : item;
          }),
        }));
      },

      importConnections: async (items) => {
        try {
          for (const item of items) {
            const normalized = normalizeDialectConfig(item.config);
            const profile = stripSecrets(normalized);
            const secrets = item.secrets ?? pickSecrets(normalized);
            await registerConnectionBackend(item.id, profile, secrets);
            set((state) => ({
              dbList: [
                ...state.dbList,
                {
                  id: item.id,
                  dialect: item.dialect,
                  displayName: item.displayName,
                  config: profile,
                  data: emptyTree(item.displayName),
                  loading: false,
                },
              ],
            }));
          }
        } catch (error) {
          console.error(error);
          toast.error(errorMessage(error, 'Failed to import connections'));
          throw error;
        }
      },
    }),
    {
      name: 'connections',
      storage: createJSONStorage(() => connectionsFileStorage),
      partialize: (state) =>
        ({
          dbList: state.dbList.map(
            (db): PersistedConnection => ({
              id: db.id,
              dialect: db.dialect,
              displayName: db.displayName,
              config: db.config
                ? stripSecrets(normalizeDialectConfig(db.config))
                : undefined,
            }),
          ),
        }) as unknown as DBListStore,
      merge: (persisted, current) => {
        const p = persisted as Partial<DBListStore> | undefined;
        const list = Array.isArray(p?.dbList) ? p.dbList : [];
        return {
          ...current,
          dbList: list.map((db) => ({
            ...db,
            data: db.data ?? emptyTree(db.displayName),
            config: db.config
              ? stripSecrets(normalizeDialectConfig(db.config))
              : undefined,
          })),
        };
      },
      onRehydrateStorage: () => async (state) => {
        try {
          if (!state) {
            return;
          }

          if (!state.dbList || state.dbList.length === 0) {
            const migrated = await migrateFromLegacyIndexedDb();
            if (migrated && migrated.length > 0) {
              const list = await hydrateCaches(migrated);
              useDBListStore.setState({ dbList: list });
              // migrate already registered each connection
              return;
            }
          }

          const list = state.dbList ?? [];
          await salvageSecretsFromLegacyIndexedDb(list);
          // Load all profiles into backend memory (secrets from vault/keychain).
          await syncConnectionsBackend(
            list.map((db) => ({ id: db.id, config: db.config })),
          );
          const withCache = await hydrateCaches(
            list.map((db) => ({
              ...db,
              config: db.config
                ? stripSecrets(normalizeDialectConfig(db.config))
                : undefined,
            })),
          );
          useDBListStore.setState({ dbList: withCache });
        } catch (error) {
          console.warn('connection rehydrate failed', error);
          toast.error(
            errorMessage(error, 'Failed to restore connections'),
          );
        } finally {
          markRegistryReady();
        }
      },
    },
  ),
);

const dbMapStore = derive<Map<string, DBType>>((get) => {
  const dbList = get(useDBListStore).dbList;
  return new Map(dbList.map((db) => [db.id, db]));
});

export const useDbMapStore = () => useStore(dbMapStore);

const tableMapStore = derive<Map<string, Map<string, TreeNode>>>((get) => {
  const dbList = get(useDBListStore).dbList;
  return new Map(dbList.map((db) => [db.id, flattenTree(db.data)]));
});

export const useTableMapStore = () => useStore(tableMapStore);

const schemaMapStore = derive<
  Map<string, Record<string, Record<string, { name: string; type: string }[]>>>
>((get) => {
  const dbList = get(useDBListStore).dbList;
  return new Map(dbList.map((db) => [db.id, db.meta ?? {}]));
});

export const useSchemaMapStore = () => useStore(schemaMapStore);

export function getDbMap() {
  return dbMapStore.getState();
}

export function getTableMap() {
  return tableMapStore.getState();
}

export function getSchemaMap() {
  return schemaMapStore.getState();
}

/** Module-level lookup — not a store action (avoids polluting state keys). */
export function getStoredDB(id: string): DBType | undefined {
  return useDBListStore.getState().dbList.find((item) => item.id === id);
}
