import { beforeEach, describe, expect, it } from 'vitest';

import {
  allInvokes,
  getInvokeMock,
  lastInvoke,
  onInvoke,
  resetTauriMock,
} from './helpers/mockTauri';
import { mysqlConfig, quackConfig } from './helpers/fixtures';

// mock must be registered before importing modules under test
import {
  exportCsv,
  getDB,
  pagingQuery,
  query,
  queryTable,
  showColumns,
  showSchema,
} from '@/api';
import {
  registerConnectionBackend,
  syncConnectionsBackend,
  unregisterConnectionBackend,
} from '@/lib/connectionRef';

describe('connection IPC contracts', () => {
  beforeEach(() => {
    resetTauriMock();
  });

  describe('register / unregister / sync', () => {
    it('registerConnectionBackend strips secrets from payload', async () => {
      onInvoke('register_connection', () => undefined);

      await registerConnectionBackend('conn-1', mysqlConfig);

      const call = lastInvoke('register_connection');
      expect(call).toBeDefined();
      const request = call![1]!.request as {
        id: string;
        payload: Record<string, unknown>;
        secrets: Record<string, string | undefined>;
      };
      expect(request.id).toBe('conn-1');
      expect(request.payload.connectionId).toBe('conn-1');
      expect(request.payload.host).toBe('10.0.0.1');
      expect(request.payload.password).toBeUndefined();
      expect(request.payload.ssh_password).toBeUndefined();
      expect(request.secrets.password).toBe('s3cret');
      expect(request.secrets.ssh_password).toBe('ssh-pass');
    });

    it('registerConnectionBackend prefers explicit secrets', async () => {
      onInvoke('register_connection', () => undefined);

      await registerConnectionBackend('c2', mysqlConfig, {
        password: 'from-form',
        token: 't',
      });

      const request = lastInvoke('register_connection')![1]!.request as {
        secrets: Record<string, string | undefined>;
      };
      expect(request.secrets.password).toBe('from-form');
      expect(request.secrets.token).toBe('t');
    });

    it('unregisterConnectionBackend passes deleteSecrets flag', async () => {
      onInvoke('unregister_connection', () => undefined);

      await unregisterConnectionBackend('c3', true);
      expect(lastInvoke('unregister_connection')![1]).toEqual({
        connectionId: 'c3',
        deleteSecrets: true,
      });

      await unregisterConnectionBackend('c3');
      expect(lastInvoke('unregister_connection')![1]).toEqual({
        connectionId: 'c3',
        deleteSecrets: false,
      });
    });

    it('syncConnectionsBackend no-ops on empty list', async () => {
      await syncConnectionsBackend([]);
      expect(getInvokeMock()).not.toHaveBeenCalled();
    });

    it('syncConnectionsBackend maps each connection', async () => {
      onInvoke('sync_connections', () => undefined);

      await syncConnectionsBackend([
        { id: 'a', config: mysqlConfig },
        { id: 'b', config: quackConfig },
      ]);

      const args = lastInvoke('sync_connections')![1]!;
      const connections = args.connections as Array<{
        id: string;
        payload: Record<string, unknown>;
        secrets: Record<string, string | undefined>;
      }>;
      expect(connections).toHaveLength(2);
      expect(connections[0].id).toBe('a');
      expect(connections[0].payload.password).toBeUndefined();
      expect(connections[0].secrets.password).toBe('s3cret');
      expect(connections[1].secrets.token).toBe('tok-abc');
    });
  });

  describe('query paths only send connectionId', () => {
    beforeEach(() => {
      onInvoke('query', () => ({
        code: 0,
        data: [],
        titles: [],
        total: 0,
        message: '',
      }));
      onInvoke('paging_query', () => ({
        code: 0,
        data: [],
        titles: [],
        total: 0,
        message: '',
      }));
      onInvoke('query_table', () => ({
        code: 0,
        data: [],
        titles: [],
        total: 0,
        message: '',
      }));
      onInvoke('export', () => undefined);
      onInvoke('show_schema', () => ({
        code: 0,
        data: [],
        titles: [],
        total: 0,
        message: '',
      }));
      onInvoke('show_column', () => ({
        code: 0,
        data: [],
        titles: [],
        total: 0,
        message: '',
      }));
    });

    it('query dialect is connectionId-only for registered connections', async () => {
      await query({
        sql: 'select 1',
        limit: 10,
        offset: 0,
        dialect: { connectionId: 'cid-1' },
      });

      const args = lastInvoke('query')![1]!;
      expect(args.dialect).toEqual({ connectionId: 'cid-1' });
      expect(JSON.stringify(args)).not.toContain('password');
      expect(JSON.stringify(args)).not.toContain('s3cret');
    });

    it('pagingQuery and queryTable use connectionId ref', async () => {
      await pagingQuery({
        sql: 'select 1',
        limit: 5,
        offset: 5,
        dialect: { connectionId: 'cid-2' },
      });
      await queryTable({
        table: 't',
        limit: 5,
        offset: 0,
        dialect: { connectionId: 'cid-2', database: 'other' },
      });

      expect(lastInvoke('paging_query')![1]!.dialect).toEqual({
        connectionId: 'cid-2',
      });
      expect(lastInvoke('query_table')![1]!.dialect).toEqual({
        connectionId: 'cid-2',
        database: 'other',
      });
    });

    it('exportCsv prefers connectionId from dbId when dialect omitted', async () => {
      await exportCsv({
        sql: 'select 1',
        limit: 10,
        offset: 0,
        file: '/tmp/out.csv',
        dbId: 'export-id',
      });

      expect(lastInvoke('export')![1]!.dialect).toEqual({
        connectionId: 'export-id',
      });
    });

    it('showSchema / showColumns pass connectionRef', async () => {
      await showSchema('public', { connectionId: 's1' });
      await showColumns('public.t', { connectionId: 's1' });

      expect(lastInvoke('show_schema')![1]!.dialect).toEqual({
        connectionId: 's1',
      });
      expect(lastInvoke('show_column')![1]!.dialect).toEqual({
        connectionId: 's1',
      });
    });
  });

  describe('getDB', () => {
    it('first-time ad-hoc open sends full dialect then registers', async () => {
      onInvoke('get_db', () => ({
        name: 'db',
        path: 'db',
        children: [],
      }));
      onInvoke('all_columns', () => [
        { database: 'app', table: 't', columns: [['id', 'int']] },
      ]);
      onInvoke('register_connection', () => undefined);

      const db = await getDB(mysqlConfig);

      expect(db.dialect).toBe('mysql');
      expect(db.defaultDatabase).toBe('app');
      // Returned config must not keep plaintext secrets for frontend state.
      expect(db.config).toMatchObject({
        dialect: 'mysql',
        host: '10.0.0.1',
      });
      expect((db.config as { password?: string } | undefined)?.password).toBeUndefined();

      const getDbCall = lastInvoke('get_db');
      expect(getDbCall![1]!.dialect).toMatchObject({
        dialect: 'mysql',
        host: '10.0.0.1',
        password: 's3cret',
      });

      const registerCalls = allInvokes('register_connection');
      expect(registerCalls.length).toBeGreaterThanOrEqual(1);
      const request = registerCalls.at(-1)![1]!.request as {
        id: string;
        payload: Record<string, unknown>;
        secrets: Record<string, string | undefined>;
      };
      expect(request.id).toBe(db.id);
      expect(request.payload.password).toBeUndefined();
      expect(request.secrets.password).toBe('s3cret');
    });

    it('open by connectionId only sends connectionId to backend', async () => {
      onInvoke('get_db', () => ({
        name: 'host',
        path: 'host',
        children: [],
      }));
      onInvoke('all_columns', () => []);

      const db = await getDB({ connectionId: 'existing-id' }, 'existing-id');

      expect(db.id).toBe('existing-id');
      expect(lastInvoke('get_db')![1]!.dialect).toEqual({
        connectionId: 'existing-id',
      });
      expect(lastInvoke('all_columns')![1]!.dialect).toEqual({
        connectionId: 'existing-id',
      });
      expect(allInvokes('register_connection')).toHaveLength(0);
    });
  });
});
