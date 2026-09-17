import { beforeEach, describe, expect, it, vi } from 'vitest';

const { memory } = vi.hoisted(() => {
  const memory = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
    removeItem: (k: string) => {
      memory.delete(k);
    },
    clear: () => {
      memory.clear();
    },
    key: (_i: number) => null as string | null,
    get length() {
      return memory.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorage,
    configurable: true,
    writable: true,
  });
  return { memory };
});

import {
  MAX_DB_SEARCH_HISTORY,
  useDbSearchHistoryStore,
} from '@/stores/dbSearchHistory';

beforeEach(() => {
  memory.clear();
  useDbSearchHistoryStore.setState({ terms: [] });
});

describe('dbSearchHistory', () => {
  it('pushes trimmed terms to the front', () => {
    const { push } = useDbSearchHistoryStore.getState();
    push('  users  ');
    push('orders');
    expect(useDbSearchHistoryStore.getState().terms).toEqual([
      'orders',
      'users',
    ]);
  });

  it('ignores empty terms', () => {
    const { push } = useDbSearchHistoryStore.getState();
    push('');
    push('   ');
    expect(useDbSearchHistoryStore.getState().terms).toEqual([]);
  });

  it('dedupes and moves re-searched terms to the front', () => {
    const { push } = useDbSearchHistoryStore.getState();
    push('users');
    push('orders');
    push('users');
    expect(useDbSearchHistoryStore.getState().terms).toEqual([
      'users',
      'orders',
    ]);
  });

  it(`caps history at ${MAX_DB_SEARCH_HISTORY} terms`, () => {
    const { push } = useDbSearchHistoryStore.getState();
    for (let i = 0; i < MAX_DB_SEARCH_HISTORY + 3; i++) {
      push(`table_${i}`);
    }
    const terms = useDbSearchHistoryStore.getState().terms;
    expect(terms).toHaveLength(MAX_DB_SEARCH_HISTORY);
    expect(terms[0]).toBe(`table_${MAX_DB_SEARCH_HISTORY + 2}`);
  });

  it('removes a single term', () => {
    const { push, remove } = useDbSearchHistoryStore.getState();
    push('users');
    push('orders');
    remove('users');
    expect(useDbSearchHistoryStore.getState().terms).toEqual(['orders']);
  });

  it('clears all terms', () => {
    const { push, clear } = useDbSearchHistoryStore.getState();
    push('users');
    clear();
    expect(useDbSearchHistoryStore.getState().terms).toEqual([]);
  });

  it('persists terms to localStorage and rehydrates', async () => {
    useDbSearchHistoryStore.getState().push('users');
    const raw = memory.get('db-search-history');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).state.terms).toEqual(['users']);

    memory.set(
      'db-search-history',
      JSON.stringify({ state: { terms: ['orders'] }, version: 0 }),
    );
    await useDbSearchHistoryStore.persist.rehydrate();
    expect(useDbSearchHistoryStore.getState().terms).toEqual(['orders']);
  });
});
