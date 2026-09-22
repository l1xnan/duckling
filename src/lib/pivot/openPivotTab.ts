import { nanoid } from 'nanoid';

import type { ComputedColumn } from '@/lib/sql/computedColumns';
import type { PivotMeasure, PivotShowAs } from '@/lib/sql/pivot';
import type { SchemaType } from '@/stores/dataset';
import {
  useTabsStore,
  type PivotColumnSnapshot,
  type PivotContextType,
} from '@/stores/tabs';
import { isNumberType } from '@/utils';

export function columnsFromSchema(
  schema: SchemaType[],
): PivotColumnSnapshot[] {
  return (schema ?? []).map((c) => ({
    name: c.name,
    numeric: isNumberType(c.dataType),
  }));
}

export function defaultPivotMeasure(
  columns: PivotColumnSnapshot[],
): PivotMeasure {
  const numeric = columns.find((c) => c.numeric);
  if (numeric) {
    return { field: numeric.name, agg: 'sum' };
  }
  return { field: '*', agg: 'count' };
}

export type CreatePivotTabInput = {
  dbId: string;
  displayName?: string;
  beautify?: boolean;
  sourceKind: 'table' | 'subquery';
  tableType?: string;
  tableId?: string;
  tableName?: string;
  schema?: string;
  sourceSql?: string;
  sqlWhere?: string;
  computedColumns?: ComputedColumn[];
  columns: PivotColumnSnapshot[];
  pivotRows?: string[];
  pivotColumns?: string[];
  pivotMeasures?: PivotMeasure[];
  showAs?: PivotShowAs;
  initialRowField?: string;
  sourceTabId?: string;
  lastSql?: string;
  id?: string;
};

export function createPivotTab(input: CreatePivotTabInput): PivotContextType {
  const names = new Set(input.columns.map((c) => c.name));
  const pref = input.initialRowField?.trim();
  const pivotRows =
    input.pivotRows ?? (pref && names.has(pref) ? [pref] : []);

  const tableLabel = input.tableName?.trim();
  const displayName =
    input.displayName?.trim() ||
    (tableLabel ? `Pivot: ${tableLabel}` : 'Pivot: query');

  return {
    id: input.id ?? nanoid(),
    type: 'pivot',
    displayName,
    dbId: input.dbId,
    beautify: input.beautify,
    sourceKind: input.sourceKind,
    tableType: input.tableType,
    tableId: input.tableId,
    tableName: input.tableName,
    schema: input.schema,
    sourceSql: input.sourceSql,
    sqlWhere: input.sqlWhere,
    computedColumns: input.computedColumns,
    columns: input.columns,
    pivotRows,
    pivotColumns: input.pivotColumns ?? [],
    pivotMeasures: input.pivotMeasures?.length
      ? input.pivotMeasures
      : [defaultPivotMeasure(input.columns)],
    showAs: input.showAs ?? 'value',
    sourceTabId: input.sourceTabId,
    lastSql: input.lastSql,
  };
}

export function openPivotTab(input: CreatePivotTabInput): PivotContextType {
  const tab = createPivotTab(input);
  const store = useTabsStore.getState();
  store.append(tab);
  store.active(tab.id);
  return tab;
}
