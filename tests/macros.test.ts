import { describe, expect, it } from 'vitest';

import {
  applyVarsToSql,
  buildVarsScaffold,
  formatMacroLabel,
  formatVarsBlock,
  mergeMacroValues,
} from '@/lib/sql/macros';

describe('formatMacroLabel', () => {
  it('returns empty for empty binding', () => {
    expect(formatMacroLabel({})).toBe('');
  });

  it('returns single value alone', () => {
    expect(formatMacroLabel({ table: 'orders' })).toBe('orders');
  });

  it('joins multiple keys', () => {
    expect(formatMacroLabel({ schema: 'public', table: 'orders' })).toBe(
      'schema=public, table=orders',
    );
  });
});

describe('formatVarsBlock', () => {
  it('formats empty scalar as quoted empty string', () => {
    const block = formatVarsBlock({ table: [''] }, ['table']);
    expect(block).toContain("table: ''");
    expect(block.startsWith('/*')).toBe(true);
    expect(block).toContain('@vars');
    expect(block.endsWith('*/')).toBe(true);
  });

  it('formats multi-value as list', () => {
    const block = formatVarsBlock(
      { table: ['orders', 'items'] },
      ['table'],
    );
    expect(block).toContain('table:');
    expect(block).toContain('  - orders');
    expect(block).toContain('  - items');
  });

  it('quotes values with special characters', () => {
    const block = formatVarsBlock({ note: ['a: b'] }, ['note']);
    expect(block).toContain("note: 'a: b'");
  });
});

describe('applyVarsToSql', () => {
  it('prepends block before body', () => {
    const sql = applyVarsToSql(
      'SELECT * FROM {{ table }}',
      { table: ['orders'] },
      ['table'],
    );
    expect(sql).toMatch(/^\/\*\n@vars\n/);
    expect(sql).toContain('table: orders');
    expect(sql).toContain('SELECT * FROM {{ table }}');
    expect(sql).not.toMatch(/@vars[\s\S]*@vars/);
  });
});

describe('buildVarsScaffold', () => {
  it('keeps provided and fills missing with empty', () => {
    const s = buildVarsScaffold(['schema', 'table'], {
      schema: ['public'],
    });
    expect(s.schema).toEqual(['public']);
    expect(s.table).toEqual(['']);
  });
});

describe('mergeMacroValues', () => {
  it('overrides win', () => {
    expect(
      mergeMacroValues(
        { table: ['old'], schema: ['public'] },
        { table: ['new'] },
      ),
    ).toEqual({ table: ['new'], schema: ['public'] });
  });
});
