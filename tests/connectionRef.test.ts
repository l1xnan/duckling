import { describe, expect, it } from 'vitest';

import { connectionRef, toRegisterRequest } from '@/lib/connectionRef';
import type { DialectConfig } from '@/stores/dbList';

const mysqlConfig = {
  dialect: 'mysql' as const,
  host: '10.0.0.1',
  port: '3306',
  username: 'u',
  password: 'p@ss',
  database: 'd',
} satisfies DialectConfig;

describe('connectionRef', () => {
  it('connectionRef only carries connectionId (+ optional overrides)', () => {
    expect(connectionRef('abc123')).toEqual({ connectionId: 'abc123' });
    expect(connectionRef('abc123', { database: 'other', dialect: 'postgres' })).toEqual({
      connectionId: 'abc123',
      database: 'other',
      dialect: 'postgres',
    });
    // Must not embed password for query IPC
    const ref = connectionRef('abc123') as Record<string, unknown>;
    expect(ref.password).toBeUndefined();
    expect(ref.host).toBeUndefined();
  });

  it('toRegisterRequest strips secrets from payload and keeps them under secrets', async () => {
    const req = await toRegisterRequest('conn-1', mysqlConfig);
    expect(req.id).toBe('conn-1');
    expect(req.payload.connectionId).toBe('conn-1');
    expect(req.payload.dialect).toBe('mysql');
    expect(req.payload.host).toBe('10.0.0.1');
    expect(req.payload.password).toBeUndefined();
    expect(req.secrets).toEqual({ password: 'p@ss' });
  });

  it('toRegisterRequest prefers explicit secrets over config fields', async () => {
    const req = await toRegisterRequest('conn-1', mysqlConfig, {
      password: 'from-form',
      token: 't',
    });
    expect(req.secrets.password).toBe('from-form');
    expect(req.secrets.token).toBe('t');
    expect(req.payload.password).toBeUndefined();
  });

  it('toRegisterRequest handles missing config', async () => {
    const req = await toRegisterRequest('x', undefined);
    expect(req.payload.dialect).toBe('duckdb');
    expect(req.payload.connectionId).toBe('x');
    expect(req.secrets).toEqual({});
  });
});
