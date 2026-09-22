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

import { Float64, Utf8 } from '@apache-arrow/ts';

import {
  columnsFromSchema,
  createPivotTab,
  defaultPivotMeasure,
  openPivotTab,
} from '@/lib/pivot/openPivotTab';
import type { SchemaType } from '@/stores/dataset';
import { useTabsStore } from '@/stores/tabs';

function schemaCol(name: string, numeric: boolean): SchemaType {
  return {
    name,
    dataType: numeric ? new Float64() : new Utf8(),
    nullable: true,
    metadata: null,
  };
}

describe('openPivotTab', () => {
  beforeEach(() => {
    memory.clear();
    const leaf = {
      type: 'leaf' as const,
      id: 'pane-root',
      tabIds: [] as string[],
      activeId: null as string | null,
    };
    useTabsStore.setState({
      ids: [],
      tabs: {},
      currentId: null,
      layout: leaf,
      focusedPaneId: leaf.id,
    });
  });

  it('snapshots schema columns as name + numeric', () => {
    expect(
      columnsFromSchema([schemaCol('region', false), schemaCol('amount', true)]),
    ).toEqual([
      { name: 'region', numeric: false },
      { name: 'amount', numeric: true },
    ]);
  });

  it('defaults measure to sum of first numeric field', () => {
    expect(
      defaultPivotMeasure([
        { name: 'region', numeric: false },
        { name: 'amount', numeric: true },
      ]),
    ).toEqual({ field: 'amount', agg: 'sum' });
  });

  it('defaults measure to count(*) when no numeric fields', () => {
    expect(
      defaultPivotMeasure([{ name: 'region', numeric: false }]),
    ).toEqual({ field: '*', agg: 'count' });
  });

  it('creates a table-source pivot tab with initial row field', () => {
    const tab = createPivotTab({
      id: 'p1',
      dbId: 'db1',
      sourceKind: 'table',
      tableType: 'table',
      tableId: 't1',
      tableName: 'orders',
      schema: 'public',
      columns: [
        { name: 'region', numeric: false },
        { name: 'amount', numeric: true },
      ],
      initialRowField: 'region',
      sourceTabId: 'src-tab',
    });

    expect(tab).toMatchObject({
      id: 'p1',
      type: 'pivot',
      displayName: 'Pivot: orders',
      dbId: 'db1',
      sourceKind: 'table',
      tableType: 'table',
      tableId: 't1',
      tableName: 'orders',
      schema: 'public',
      pivotRows: ['region'],
      pivotColumns: [],
      pivotMeasures: [{ field: 'amount', agg: 'sum' }],
      showAs: 'value',
      sourceTabId: 'src-tab',
    });
  });

  it('creates a subquery-source pivot tab', () => {
    const tab = createPivotTab({
      id: 'p2',
      dbId: 'db1',
      sourceKind: 'subquery',
      sourceSql: 'SELECT * FROM orders',
      columns: [{ name: 'id', numeric: true }],
      pivotRows: ['id'],
      pivotMeasures: [{ field: 'id', agg: 'count' }],
      showAs: 'rowPct',
      lastSql: 'SELECT 1',
    });

    expect(tab.type).toBe('pivot');
    expect(tab.displayName).toBe('Pivot: query');
    expect(tab.sourceKind).toBe('subquery');
    expect(tab.sourceSql).toBe('SELECT * FROM orders');
    expect(tab.tableId).toBeUndefined();
    expect(tab.pivotRows).toEqual(['id']);
    expect(tab.showAs).toBe('rowPct');
    expect(tab.lastSql).toBe('SELECT 1');
  });

  it('prefers explicit pivotRows over initialRowField', () => {
    const tab = createPivotTab({
      id: 'p3',
      dbId: 'db1',
      sourceKind: 'table',
      tableId: 't1',
      columns: [
        { name: 'a', numeric: false },
        { name: 'b', numeric: false },
      ],
      pivotRows: ['b'],
      initialRowField: 'a',
    });
    expect(tab.pivotRows).toEqual(['b']);
  });

  it('openPivotTab appends and activates the tab', () => {
    const tab = openPivotTab({
      id: 'p-open',
      dbId: 'db1',
      sourceKind: 'table',
      tableId: 't1',
      tableName: 'orders',
      columns: [{ name: 'region', numeric: false }],
    });

    const state = useTabsStore.getState();
    expect(state.ids).toContain('p-open');
    expect(state.currentId).toBe('p-open');
    expect(state.tabs['p-open']?.type).toBe('pivot');
    expect(tab.id).toBe('p-open');
  });

  it('patch round-trips editable pivot config', () => {
    openPivotTab({
      id: 'p-patch',
      dbId: 'db1',
      sourceKind: 'table',
      tableId: 't1',
      columns: [{ name: 'region', numeric: false }],
    });

    useTabsStore.getState().patch('p-patch', {
      pivotRows: ['region'],
      showAs: 'colPct',
      lastSql: 'SELECT 1',
    });

    const patched = useTabsStore.getState().tabs['p-patch'];
    expect(patched).toMatchObject({
      type: 'pivot',
      pivotRows: ['region'],
      showAs: 'colPct',
      lastSql: 'SELECT 1',
    });
  });
});
