import { describe, expect, it } from 'vitest';

import {
  buildPlainExport,
  collectSecretsById,
  CONNECTIONS_EXPORT_FORMAT,
  CONNECTIONS_EXPORT_VERSION,
  mapImportProfiles,
  parseConnectionsExport,
  toConnectionProfile,
} from '@/lib/connectionTransfer';
import type { DialectConfig } from '@/stores/dbList';

const mysqlWithSecret = {
  dialect: 'mysql' as const,
  host: 'db.example.com',
  port: '3306',
  username: 'admin',
  password: 'plain-password',
  database: 'main',
} satisfies DialectConfig;

describe('connectionTransfer', () => {
  it('toConnectionProfile strips secrets from config', () => {
    const profile = toConnectionProfile({
      id: 'c1',
      displayName: 'Prod MySQL',
      dialect: 'mysql',
      config: mysqlWithSecret,
    });
    expect(profile.config).toBeDefined();
    expect((profile.config as { password?: string }).password).toBeUndefined();
    expect((profile.config as { host?: string }).host).toBe('db.example.com');
  });

  it('buildPlainExport never includes plaintext secrets', () => {
    const file = buildPlainExport([
      toConnectionProfile({
        id: 'c1',
        displayName: 'Prod',
        dialect: 'mysql',
        config: mysqlWithSecret,
      }),
    ]);
    expect(file.format).toBe(CONNECTIONS_EXPORT_FORMAT);
    expect(file.version).toBe(CONNECTIONS_EXPORT_VERSION);
    expect(file.includeSecrets).toBe(false);
    expect(file.secretsBlob).toBeUndefined();
    const raw = JSON.stringify(file);
    expect(raw).not.toContain('plain-password');
    expect(raw).not.toContain('"password"');
  });

  it('buildPlainExport strips secrets even if caller passes them', () => {
    const file = buildPlainExport([
      {
        id: 'c1',
        displayName: 'Bad',
        dialect: 'mysql',
        // intentionally not pre-stripped
        config: mysqlWithSecret,
      },
    ]);
    expect((file.connections[0].config as { password?: string }).password).toBeUndefined();
    expect(JSON.stringify(file)).not.toContain('plain-password');
  });

  it('collectSecretsById maps id -> secrets', () => {
    const byId = collectSecretsById([
      { id: 'a', config: mysqlWithSecret },
      {
        id: 'b',
        config: {
          dialect: 'duckdb',
          path: '/tmp/x.duckdb',
        },
      },
    ]);
    expect(byId.a).toEqual({ password: 'plain-password' });
    expect(byId.b).toBeUndefined();
  });

  it('parseConnectionsExport validates schema and strips secrets', () => {
    const exported = buildPlainExport([
      toConnectionProfile({
        id: 'c1',
        displayName: 'Prod',
        dialect: 'mysql',
        config: mysqlWithSecret,
      }),
    ]);
    const parsed = parseConnectionsExport(JSON.stringify(exported));
    expect(parsed.connections).toHaveLength(1);
    expect(parsed.connections[0].id).toBe('c1');
    expect(parsed.includeSecrets).toBe(false);
  });

  it('parseConnectionsExport rejects invalid files', () => {
    expect(() => parseConnectionsExport('not-json')).toThrow(/Invalid JSON/);
    expect(() => parseConnectionsExport('{}')).toThrow(/Unsupported format/);
    expect(() =>
      parseConnectionsExport(
        JSON.stringify({
          format: CONNECTIONS_EXPORT_FORMAT,
          version: 99,
          connections: [],
        }),
      ),
    ).toThrow(/Unsupported version/);
    // Defensive: secrets in input config are stripped, not rejected.
    const parsedWithSecret = parseConnectionsExport(
      JSON.stringify({
        format: CONNECTIONS_EXPORT_FORMAT,
        version: CONNECTIONS_EXPORT_VERSION,
        includeSecrets: false,
        connections: [
          {
            id: 'c1',
            displayName: 'X',
            dialect: 'mysql',
            config: mysqlWithSecret,
          },
        ],
      }),
    );
    expect(
      (parsedWithSecret.connections[0].config as { password?: string })
        .password,
    ).toBeUndefined();
  });

  it('mapImportProfiles assigns new ids and attaches secrets by export id', () => {
    const file = buildPlainExport([
      toConnectionProfile({
        id: 'export-id-1',
        displayName: 'Staging',
        dialect: 'mysql',
        config: mysqlWithSecret,
      }),
    ]);
    const items = mapImportProfiles(file, {
      'export-id-1': { password: 'imported-pass' },
    });
    expect(items).toHaveLength(1);
    expect(items[0].id).not.toBe('export-id-1');
    expect(items[0].displayName).toContain('(imported)');
    expect(items[0].secrets.password).toBe('imported-pass');
    expect((items[0].config as { password?: string }).password).toBeUndefined();
  });
});
