import { describe, expect, it } from 'vitest';

import {
  flattenSshTunnelForBackend,
  hasPlaintextSecrets,
  mergeSecrets,
  normalizeDialectConfig,
  pickSecrets,
  resolveSecretsForSave,
  secretsAreEmpty,
  stripSecrets,
} from '@/lib/connectionConfig';
import type { DialectConfig } from '@/stores/dbList';

const mysqlConfig = {
  dialect: 'mysql' as const,
  host: '127.0.0.1',
  port: '3306',
  username: 'root',
  password: 's3cret',
  database: 'app',
  ssh_tunnel: {
    enabled: true,
    host: 'bastion',
    password: 'ssh-pass',
    passphrase: 'key-pass',
  },
} satisfies DialectConfig;

const legacyMysqlConfig = {
  dialect: 'mysql' as const,
  host: '127.0.0.1',
  port: '3306',
  username: 'root',
  password: 's3cret',
  database: 'app',
  ssh_enabled: true,
  ssh_host: 'bastion',
  ssh_password: 'ssh-pass',
  ssh_passphrase: 'key-pass',
} as DialectConfig;

const quackConfig = {
  dialect: 'quack' as const,
  uri: 'quack:localhost',
  token: 'tok-abc',
  disable_ssl: true,
} satisfies DialectConfig;

describe('connectionConfig', () => {
  it('pickSecrets extracts only non-empty sensitive fields', () => {
    expect(pickSecrets(mysqlConfig)).toEqual({
      password: 's3cret',
      ssh_password: 'ssh-pass',
      ssh_passphrase: 'key-pass',
    });
    expect(pickSecrets(quackConfig)).toEqual({ token: 'tok-abc' });
    expect(pickSecrets(undefined)).toEqual({});
    expect(
      pickSecrets({
        ...mysqlConfig,
        password: '',
        ssh_tunnel: {
          ...mysqlConfig.ssh_tunnel,
          password: '',
        },
      }),
    ).toEqual({
      ssh_passphrase: 'key-pass',
    });
  });

  it('pickSecrets reads legacy flat ssh_* fields', () => {
    expect(pickSecrets(legacyMysqlConfig)).toEqual({
      password: 's3cret',
      ssh_password: 'ssh-pass',
      ssh_passphrase: 'key-pass',
    });
  });

  it('stripSecrets removes sensitive fields from profile', () => {
    const stripped = stripSecrets(mysqlConfig) as {
      password?: string;
      host?: string;
      username?: string;
      ssh_tunnel?: { password?: string; passphrase?: string; host?: string };
    };
    expect(stripped.password).toBeUndefined();
    expect(stripped.ssh_tunnel?.password).toBeUndefined();
    expect(stripped.ssh_tunnel?.passphrase).toBeUndefined();
    expect(stripped.ssh_tunnel?.host).toBe('bastion');
    expect(stripped.host).toBe('127.0.0.1');
    expect(stripped.username).toBe('root');
    expect(hasPlaintextSecrets(stripped)).toBe(false);
  });

  it('normalizeDialectConfig migrates flat ssh_* into ssh_tunnel', () => {
    const normalized = normalizeDialectConfig(legacyMysqlConfig) as {
      ssh_tunnel?: { enabled?: boolean; host?: string; password?: string };
      ssh_host?: string;
    };
    expect(normalized.ssh_tunnel).toMatchObject({
      enabled: true,
      host: 'bastion',
      password: 'ssh-pass',
    });
    expect(normalized.ssh_host).toBeUndefined();
  });

  it('flattenSshTunnelForBackend maps nested tunnel to flat ssh_*', () => {
    const flat = flattenSshTunnelForBackend(mysqlConfig);
    expect(flat.ssh_enabled).toBe(true);
    expect(flat.ssh_host).toBe('bastion');
    expect(flat.ssh_password).toBe('ssh-pass');
    expect(flat.ssh_tunnel).toBeUndefined();
  });

  it('mergeSecrets rehydrates credentials without mutating base host fields', () => {
    const base = stripSecrets(mysqlConfig);
    const merged = mergeSecrets(base, {
      password: 'new-pass',
      ssh_password: 'ssh2',
    }) as {
      password?: string;
      host?: string;
      ssh_tunnel?: { password?: string };
    };
    expect(merged.password).toBe('new-pass');
    expect(merged.ssh_tunnel?.password).toBe('ssh2');
    expect(merged.host).toBe('127.0.0.1');
  });

  it('hasPlaintextSecrets detects nested secrets', () => {
    expect(hasPlaintextSecrets({ connections: [mysqlConfig] })).toBe(true);
    expect(
      hasPlaintextSecrets({
        connections: [stripSecrets(mysqlConfig)],
      }),
    ).toBe(false);
  });

  it('resolveSecretsForSave keeps previous secrets when form fields are empty', () => {
    const previous = {
      ...mysqlConfig,
      password: 'old',
      ssh_tunnel: {
        ...mysqlConfig.ssh_tunnel,
        password: 'old-ssh',
      },
    };
    const next = {
      ...stripSecrets(mysqlConfig),
      password: '',
    } as DialectConfig;

    expect(
      resolveSecretsForSave({
        nextConfig: next,
        previousConfig: previous,
      }),
    ).toEqual({
      password: 'old',
      ssh_password: 'old-ssh',
      ssh_passphrase: 'key-pass',
      token: undefined,
    });

    expect(
      resolveSecretsForSave({
        nextConfig: { ...mysqlConfig, password: 'updated' },
        previousConfig: previous,
      }).password,
    ).toBe('updated');

    expect(
      resolveSecretsForSave({
        nextConfig: next,
        previousConfig: previous,
        clearSecrets: true,
      }),
    ).toEqual({});
  });

  it('secretsAreEmpty', () => {
    expect(secretsAreEmpty({})).toBe(true);
    expect(secretsAreEmpty({ password: '' })).toBe(true);
    expect(secretsAreEmpty({ password: 'x' })).toBe(false);
  });
});
