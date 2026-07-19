import { describe, expect, it } from 'vitest';

import { nextOrderBy, orderByClause } from '@/lib/sql/orderBy';

describe('orderBy helpers', () => {
  it('builds quoted order clause', () => {
    expect(orderByClause('userId', false, 'postgres')).toBe('"userId" ASC');
    expect(orderByClause('userId', true, 'mysql')).toBe('`userId` DESC');
  });

  it('cycles sort state none → ASC → DESC → none', () => {
    expect(nextOrderBy(undefined, 'a')).toEqual({ name: 'a', desc: false });
    expect(nextOrderBy({ name: 'a', desc: false }, 'a')).toEqual({
      name: 'a',
      desc: true,
    });
    expect(nextOrderBy({ name: 'a', desc: true }, 'a')).toBeUndefined();
    expect(nextOrderBy({ name: 'a', desc: false }, 'b')).toEqual({
      name: 'b',
      desc: false,
    });
  });
});
