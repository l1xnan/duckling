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
  collectAppMetrics,
  resolveMemoryDiagnosticsIntervalSec,
} from '@/lib/memoryDiagnostics';
import { useQuerySessionStore } from '@/stores/querySession';
import { useTabsStore } from '@/stores/tabs';

describe('resolveMemoryDiagnosticsIntervalSec', () => {
  it('defaults and clamps', () => {
    expect(resolveMemoryDiagnosticsIntervalSec(undefined)).toBe(30);
    expect(resolveMemoryDiagnosticsIntervalSec(5)).toBe(15);
    expect(resolveMemoryDiagnosticsIntervalSec(9999)).toBe(600);
    expect(resolveMemoryDiagnosticsIntervalSec(45)).toBe(45);
  });
});

describe('collectAppMetrics', () => {
  beforeEach(() => {
    useTabsStore.setState({
      ids: ['ed1', 'tbl1'],
      tabs: {
        ed1: {
          id: 'ed1',
          type: 'editor',
          dbId: 'db1',
          displayName: 'scratch',
        },
        ed2: {
          id: 'ed2',
          type: 'editor',
          dbId: 'db1',
          displayName: 'soft-closed',
        },
        tbl1: {
          id: 'tbl1',
          type: 'table',
          dbId: 'db1',
          tableId: 't',
          displayName: 't',
        },
      },
      currentId: 'ed1',
    } as never);

    useQuerySessionStore.setState({
      byEditor: {
        ed1: {
          order: ['q1', 'q2'],
          byId: {
            q1: {
              id: 'q1',
              type: 'query',
              dbId: 'db1',
              tableId: '',
              displayName: '1',
              page: 1,
              perPage: 500,
              total: 2,
              elapsed: 1,
              direction: 'horizontal',
              hiddenColumns: {},
              cross: false,
              data: [
                { a: 'hello', b: 1 },
                { a: 'world', b: 2 },
              ],
              tableSchema: [
                { name: 'a', type: 'Utf8' },
                { name: 'b', type: 'Int32' },
              ] as never,
            },
            q2: {
              id: 'q2',
              type: 'query',
              dbId: 'db1',
              tableId: '',
              displayName: '2',
              page: 1,
              perPage: 500,
              total: 0,
              elapsed: 1,
              direction: 'horizontal',
              hiddenColumns: {},
              cross: false,
              data: [],
            },
          },
          activeKey: 'q1',
        },
      },
    });
  });

  it('counts tabs, soft-closed editors, and result metrics', () => {
    const m = collectAppMetrics();
    expect(m.mainTabs).toBe(2);
    expect(m.openTableTabs).toBe(1);
    expect(m.softClosedEditors).toBe(1);
    expect(m.resultTabs).toBe(2);
    expect(m.resultRows).toBe(2);
    expect(m.resultEstKb).toBeGreaterThanOrEqual(0);
  });

  it('handles empty session', () => {
    useQuerySessionStore.setState({ byEditor: {} });
    useTabsStore.setState({ ids: [], tabs: {} } as never);
    const m = collectAppMetrics();
    expect(m).toEqual({
      mainTabs: 0,
      softClosedEditors: 0,
      resultTabs: 0,
      resultRows: 0,
      resultEstKb: 0,
      openTableTabs: 0,
    });
  });
});
