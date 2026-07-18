import type { DialectConfig } from '@/stores/dbList';

export const mysqlConfig = {
  dialect: 'mysql' as const,
  host: '10.0.0.1',
  port: '3306',
  username: 'root',
  password: 's3cret',
  database: 'app',
  ssh_tunnel: {
    enabled: true,
    host: 'bastion',
    port: '22',
    username: 'deploy',
    password: 'ssh-pass',
    passphrase: 'key-pass',
  },
} satisfies DialectConfig;

export const postgresConfig = {
  dialect: 'postgres' as const,
  host: 'pg.example.com',
  port: '5432',
  username: 'pguser',
  password: 'pg-secret',
  database: 'warehouse',
} satisfies DialectConfig;

export const quackConfig = {
  dialect: 'quack' as const,
  uri: 'quack:localhost:9494',
  token: 'tok-abc',
  disable_ssl: true,
} satisfies DialectConfig;

export const duckdbConfig = {
  dialect: 'duckdb' as const,
  path: '/data/demo.duckdb',
} satisfies DialectConfig;

export const clickhouseConfig = {
  dialect: 'clickhouse' as const,
  host: 'ch.example.com',
  port: '8123',
  username: 'admin',
  password: 'ch-pass',
  database: 'default',
} satisfies DialectConfig;
