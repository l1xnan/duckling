import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  registerConnectionBackend,
  unregisterConnectionBackend,
  syncConnectionsBackend,
  setConnectionSecrets,
  setDbCache,
  deleteDbCache,
  loadDbCaches,
  getDB,
  idb,
  fileMem,
} = vi.hoisted(() => ({
  registerConnectionBackend: vi.fn(async () => undefined),
  unregisterConnectionBackend: vi.fn(async () => undefined),
  syncConnectionsBackend: vi.fn(async () => undefined),
  setConnectionSecrets: vi.fn(async () => undefined),
  setDbCache: vi.fn(async () => undefined),
  deleteDbCache: vi.fn(async () => undefined),
  loadDbCaches: vi.fn(async () => new Map()),
  getDB: vi.fn(async () => ({
    id: 'ignored',
    dialect: 'mysql' as const,
    displayName: 'host',
    data: { name: 'host', path: 'host', children: [] },
    meta: {},
    defaultDatabase: 'app',
  })),
  idb: new Map<string, string>(),
  fileMem: new Map<string, string>(),
}));

vi.mock('@/lib/connectionRef', () => ({
  registerConnectionBackend: (...args: unknown[]) =>
    registerConnectionBackend(...args),
  unregisterConnectionBackend: (...args: unknown[]) =>
    unregisterConnectionBackend(...args),
  syncConnectionsBackend: (...args: unknown[]) =>
    syncConnectionsBackend(...args),
}));

vi.mock('@/stores/secretStore', () => ({
  setConnectionSecrets: (...args: unknown[]) => setConnectionSecrets(...args),
  getConnectionSecrets: vi.fn(async () => null),
  deleteConnectionSecrets: vi.fn(async () => undefined),
}));

vi.mock('@/stores/dbCache', () => ({
  setDbCache: (...args: unknown[]) => setDbCache(...args),
  deleteDbCache: (...args: unknown[]) => deleteDbCache(...args),
  loadDbCaches: (...args: unknown[]) => loadDbCaches(...args),
  getDbCache: vi.fn(async () => null),
}));

vi.mock('@/stores/indexdb', () => ({
  indexDBStorage: {
    getItem: async (k: string) => idb.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      idb.set(k, v);
    },
    removeItem: async (k: string) => {
      idb.delete(k);
    },
  },
}));

vi.mock('@/stores/tauriStore', () => ({
  connectionsFileStorage: {
    getItem: async (k: string) => fileMem.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      fileMem.set(k, v);
    },
    removeItem: async (k: string) => {
      fileMem.delete(k);
    },
  },
  tauriFileStorage: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

vi.mock('@/api', () => ({
  getDB: (...args: unknown[]) => getDB(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

import { useDBListStore } from '@/stores/dbList';
import { mysqlConfig, quackConfig } from './helpers/fixtures';

describe('dbListStore connection lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idb.clear();
    fileMem.clear();
    useDBListStore.setState({ dbList: [] });
  });

  it('append strips secrets in store and registers backend with secrets', async () => {
    await useDBListStore.getState().append({
      id: 'c1',
      dialect: 'mysql',
      displayName: 'MySQL',
      config: mysqlConfig,
      data: { name: 'MySQL', path: 'MySQL' },
    });

    const stored = useDBListStore.getState().getDB('c1');
    expect(stored?.config).toBeDefined();
    expect((stored?.config as { password?: string } | undefined)?.password).toBeUndefined();
    expect((stored?.config as { host?: string } | undefined)?.host).toBe(
      '10.0.0.1',
    );

    expect(registerConnectionBackend).toHaveBeenCalled();
    const [id, profile, secrets] = registerConnectionBackend.mock.calls[0];
    expect(id).toBe('c1');
    expect((profile as { password?: string }).password).toBeUndefined();
    expect(secrets).toMatchObject({
      password: 's3cret',
      ssh_password: 'ssh-pass',
    });
  });

  it('setCwd re-registers connection with updated cwd', async () => {
    useDBListStore.setState({
      dbList: [
        {
          id: 'c1',
          dialect: 'folder',
          displayName: 'data',
          data: { name: 'data', path: '/old' },
          config: { dialect: 'folder', path: '/old', cwd: '/old' },
        },
      ],
    });

    await useDBListStore.getState().setCwd('/new-cwd', 'c1');

    const stored = useDBListStore.getState().getDB('c1');
    expect((stored?.config as { cwd?: string } | undefined)?.cwd).toBe(
      '/new-cwd',
    );
    expect(registerConnectionBackend).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ path: '/old', cwd: '/new-cwd' }),
      {},
    );
  });

  it('remove unregisters with deleteSecrets and drops from list', async () => {
    useDBListStore.setState({
      dbList: [
        {
          id: 'c1',
          dialect: 'mysql',
          displayName: 'x',
          data: { name: 'x', path: 'x' },
          config: {
            dialect: 'mysql',
            host: 'h',
            port: '1',
            username: 'u',
            password: '',
            database: 'd',
          },
        },
      ],
    });

    useDBListStore.getState().remove('c1');

    expect(useDBListStore.getState().dbList).toHaveLength(0);
    await vi.waitFor(() => {
      expect(unregisterConnectionBackend).toHaveBeenCalledWith('c1', true);
    });
    expect(deleteDbCache).toHaveBeenCalledWith('c1');
  });

  it('setDB registers stripped profile and form secrets', async () => {
    useDBListStore.setState({
      dbList: [
        {
          id: 'c1',
          dialect: 'mysql',
          displayName: 'x',
          data: { name: 'x', path: 'x' },
          config: {
            dialect: 'mysql',
            host: 'old',
            port: '3306',
            username: 'u',
            password: '',
            database: 'd',
          },
        },
      ],
    });

    await useDBListStore.getState().setDB('c1', {
      ...mysqlConfig,
      host: 'new-host',
    });

    const stored = useDBListStore.getState().getDB('c1');
    expect((stored?.config as { host?: string } | undefined)?.host).toBe(
      'new-host',
    );
    expect(
      (stored?.config as { password?: string } | undefined)?.password,
    ).toBeUndefined();

    expect(registerConnectionBackend).toHaveBeenCalled();
    const [, profile, secrets] = registerConnectionBackend.mock.calls.at(-1)!;
    expect((profile as { host?: string }).host).toBe('new-host');
    expect((profile as { password?: string }).password).toBeUndefined();
    expect(secrets).toMatchObject({ password: 's3cret' });
  });

  it('updateByConfig registers then queries by connectionId only', async () => {
    useDBListStore.setState({
      dbList: [
        {
          id: 'c1',
          dialect: 'mysql',
          displayName: 'x',
          data: { name: 'x', path: 'x' },
          config: {
            dialect: 'mysql',
            host: 'h',
            port: '3306',
            username: 'u',
            password: '',
            database: 'd',
          },
        },
      ],
    });

    await useDBListStore.getState().updateByConfig('c1', mysqlConfig);

    expect(registerConnectionBackend).toHaveBeenCalled();
    expect(getDB).toHaveBeenCalledWith({ connectionId: 'c1' }, 'c1');
    expect(setDbCache).toHaveBeenCalled();

    const stored = useDBListStore.getState().getDB('c1');
    expect(stored).toBeDefined();
    expect(
      (stored?.config as { password?: string } | undefined)?.password,
    ).toBeUndefined();
    expect(stored?.defaultDatabase).toBe('app');
    expect(stored?.loading).toBe(false);
  });

  it('importConnections strips secrets and registers each item', async () => {
    await useDBListStore.getState().importConnections([
      {
        id: 'imp-1',
        displayName: 'Imported',
        dialect: 'quack',
        config: quackConfig,
        secrets: { token: 'imported-token' },
      },
    ]);

    const stored = useDBListStore.getState().getDB('imp-1');
    expect(stored?.displayName).toBe('Imported');
    expect(
      (stored?.config as { token?: string } | undefined)?.token,
    ).toBeUndefined();
    expect(registerConnectionBackend).toHaveBeenCalledWith(
      'imp-1',
      expect.objectContaining({ dialect: 'quack', uri: 'quack:localhost:9494' }),
      { token: 'imported-token' },
    );
  });

  it('partialize never keeps plaintext secrets', () => {
    useDBListStore.setState({
      dbList: [
        {
          id: 'c1',
          dialect: 'mysql',
          displayName: 'x',
          data: { name: 'x', path: 'x', children: [{ name: 't', path: 't' }] },
          meta: { app: { t: [{ name: 'id', type: 'int' }] } },
          config: mysqlConfig,
          loading: true,
        },
      ],
    });

    const partial = (
      useDBListStore.persist as unknown as {
        getOptions: () => {
          partialize: (s: unknown) => {
            dbList: Array<Record<string, unknown>>;
          };
        };
      }
    )
      .getOptions()
      .partialize(useDBListStore.getState());

    expect(partial.dbList).toHaveLength(1);
    expect(partial.dbList[0]).toMatchObject({
      id: 'c1',
      dialect: 'mysql',
      displayName: 'x',
    });
    expect(partial.dbList[0].data).toBeUndefined();
    expect(partial.dbList[0].meta).toBeUndefined();
    expect(partial.dbList[0].loading).toBeUndefined();
    expect(JSON.stringify(partial)).not.toContain('s3cret');
    expect(JSON.stringify(partial)).not.toContain('ssh-pass');
    expect(
      (partial.dbList[0].config as { password?: string } | undefined)?.password,
    ).toBeUndefined();
  });
});
