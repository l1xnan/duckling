import type { QueryContextType } from '@/stores/tabs';
import { useQuerySessionStore } from '@/stores/querySession';
import { useTabsStore } from '@/stores/tabs';

export type AppMemoryMetrics = {
  mainTabs: number;
  softClosedEditors: number;
  resultTabs: number;
  resultRows: number;
  resultEstKb: number;
  openTableTabs: number;
};

const BYTES_PER_CELL_EST = 64;
const SAMPLE_ROWS = 2;

function estimateRowBytes(row: unknown): number {
  if (row == null) {
    return BYTES_PER_CELL_EST;
  }
  if (typeof row !== 'object') {
    return String(row).length * 2;
  }
  let total = 0;
  for (const value of Object.values(row as Record<string, unknown>)) {
    if (value == null) {
      total += 4;
    } else if (typeof value === 'string') {
      total += value.length * 2;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      total += 8;
    } else {
      total += BYTES_PER_CELL_EST;
    }
  }
  return Math.max(total, BYTES_PER_CELL_EST);
}

function estimateResultKb(child: QueryContextType): number {
  const data = child.data;
  if (!data || data.length === 0) {
    return 0;
  }
  const cols =
    child.tableSchema?.length ||
    child.titles?.length ||
    (data[0] && typeof data[0] === 'object'
      ? Object.keys(data[0] as object).length
      : 1);
  const sampleN = Math.min(SAMPLE_ROWS, data.length);
  let sampleBytes = 0;
  for (let i = 0; i < sampleN; i++) {
    sampleBytes += estimateRowBytes(data[i]);
  }
  const avg =
    sampleBytes > 0
      ? sampleBytes / sampleN
      : cols * BYTES_PER_CELL_EST;
  return Math.round((avg * data.length) / 1024);
}

/** Lightweight scan of in-memory UI state (no full JSON.stringify of grids). */
export function collectAppMetrics(): AppMemoryMetrics {
  const { tabs, ids } = useTabsStore.getState();
  const layoutIdSet = new Set(ids);

  let softClosedEditors = 0;
  let openTableTabs = 0;
  let mainTabs = 0;

  for (const tab of Object.values(tabs)) {
    if (!tab) continue;
    if (layoutIdSet.has(tab.id)) {
      mainTabs += 1;
      if (tab.type === 'table') {
        openTableTabs += 1;
      }
    } else if (tab.type === 'editor') {
      softClosedEditors += 1;
    }
  }

  const { byEditor } = useQuerySessionStore.getState();
  let resultTabs = 0;
  let resultRows = 0;
  let resultEstKb = 0;

  for (const session of Object.values(byEditor)) {
    if (!session) continue;
    for (const childId of session.order) {
      const child = session.byId[childId];
      if (!child) continue;
      resultTabs += 1;
      const rows = child.data?.length ?? 0;
      resultRows += rows;
      resultEstKb += estimateResultKb(child);
    }
  }

  return {
    mainTabs,
    softClosedEditors,
    resultTabs,
    resultRows,
    resultEstKb,
    openTableTabs,
  };
}

export const DEFAULT_MEMORY_DIAGNOSTICS_INTERVAL_SEC = 30;

export function resolveMemoryDiagnosticsIntervalSec(
  value: number | undefined | null,
): number {
  if (value == null || !Number.isFinite(value)) {
    return DEFAULT_MEMORY_DIAGNOSTICS_INTERVAL_SEC;
  }
  return Math.min(600, Math.max(15, Math.round(value)));
}
