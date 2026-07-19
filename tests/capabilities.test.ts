import { describe, expect, it } from 'vitest';

import {
  canDropTable,
  canExport,
  canFind,
  canMetadata,
  canTableBrowse,
  capsForDialect,
  hasCapability,
  isQueryErrorCode,
} from '@/lib/capabilities';

describe('capsForDialect', () => {
  it('matches product expectations for network SQL dialects', () => {
    for (const d of ['mysql', 'postgres', 'clickhouse', 'quack']) {
      expect(canExport(d)).toBe(true);
      expect(canDropTable(d)).toBe(false);
      expect(canFind(d)).toBe(false);
      expect(hasCapability(d, 'query')).toBe(true);
    }
  });

  it('folder supports find and drop_table', () => {
    expect(canFind('folder')).toBe(true);
    expect(canDropTable('folder')).toBe(true);
    expect(canExport('folder')).toBe(true);
  });

  it('duckdb supports drop_table and export', () => {
    expect(canDropTable('duckdb')).toBe(true);
    expect(canExport('duckdb')).toBe(true);
  });

  it('file does not support export or find', () => {
    expect(canExport('file')).toBe(false);
    expect(canFind('file')).toBe(false);
    expect(hasCapability('file', 'query')).toBe(true);
  });

  it('unknown dialect only gets query', () => {
    const caps = capsForDialect('unknown');
    expect([...caps]).toEqual(['query']);
  });

  it('handles empty dialect', () => {
    expect(hasCapability(undefined, 'query')).toBe(true);
    expect(canExport(null)).toBe(false);
  });

  it('metadata and table_browse flags', () => {
    expect(canMetadata('mysql')).toBe(true);
    expect(canMetadata('file')).toBe(false);
    expect(canTableBrowse('sqlite')).toBe(true);
    expect(canTableBrowse('unknown')).toBe(false);
  });

  it('isQueryErrorCode treats only non-zero as error', () => {
    expect(isQueryErrorCode(0)).toBe(false);
    expect(isQueryErrorCode(undefined)).toBe(false);
    expect(isQueryErrorCode(400)).toBe(true);
    expect(isQueryErrorCode(499)).toBe(true);
  });
});
