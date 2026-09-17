import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
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
});

import {
  MAX_TABLE_CLAUSE_HISTORY,
  useTableClauseHistoryStore,
} from '@/stores/tableClauseHistory';

describe('useTableClauseHistoryStore', () => {
  beforeEach(() => {
    useTableClauseHistoryStore.setState({
      whereTerms: [],
      orderByTerms: [],
    });
  });

  it('dedupes and caps WHERE history', () => {
    const { pushWhere } = useTableClauseHistoryStore.getState();
    pushWhere('a = 1');
    pushWhere('b = 2');
    pushWhere('a = 1');
    expect(useTableClauseHistoryStore.getState().whereTerms).toEqual([
      'a = 1',
      'b = 2',
    ]);
    for (let i = 0; i < MAX_TABLE_CLAUSE_HISTORY + 2; i++) {
      pushWhere(`x = ${i}`);
    }
    expect(
      useTableClauseHistoryStore.getState().whereTerms.length,
    ).toBeLessThanOrEqual(MAX_TABLE_CLAUSE_HISTORY);
  });
});
