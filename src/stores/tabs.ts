import { nanoid } from 'nanoid';
import { isEmpty, shake } from 'radash';
import { toast } from 'sonner';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tabsFileStorage } from '@/stores/tauriStore';

import {
  cancelQuery,
  exportCsv,
  pagingQuery,
  query,
  QueryParams,
  queryTable,
  QueryTableParams,
  ResultType,
  TitleType,
} from '@/api';

import { isQueryErrorCode } from '@/lib/capabilities';
import { connectionRef, type DialectRef } from '@/lib/connectionRef';

import { Direction, SchemaType } from './dataset';
import { getDbMap, getTableMap, whenRegistryReady } from './dbList';
import { useQuerySessionStore } from './querySession';
import { useSettingStore } from './setting';
import {
  addTabToLeaf,
  collectTabIds,
  createDefaultLayout,
  dropTabOnPane,
  findLeaf,
  findLeafByTab,
  moveTab as moveTabInLayout,
  removeTabFromLayout,
  resolveCurrentId,
  resolveFocusedPaneId,
  setSplitSizes,
  splitLeaf,
  syncLayoutWithIds,
  updateLeaf,
  type PaneDropZone,
  type PaneId,
  type PaneNode,
  type SplitDirection,
} from './tabLayout';

export {
  EMPTY_BY_ID,
  EMPTY_CHILDREN,
  EMPTY_ORDER,
  EMPTY_SESSION,
  getOrderedChildren,
  getQueryChild,
  useQuerySessionStore,
} from './querySession';
export type { EditorSession } from './querySession';
export type {
  PaneDropZone,
  PaneId,
  PaneLeaf,
  PaneNode,
  PaneSplit,
  SplitDirection,
} from './tabLayout';

export type QueryParamType = {
  dbId: string;
  tableId: string;
  schema?: string;
  tableName?: string;
  type?: string;
  stmt?: string;

  page: number;
  perPage: number;

  hasLimit?: boolean;

  sqlWhere?: string;
  sqlOrderBy?: string;
};
/** Monaco range of the executed SQL fragment within the full editor document. */
export type SqlSourceRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

export type QueryContextType = QueryParamType & {
  id: string;
  type: 'query';
  extra?: unknown;
  displayName: string;

  total: number;
  elapsed: number;

  data?: unknown[];
  sql?: string;
  titles?: TitleType[];
  tableSchema?: SchemaType[];
  hiddenColumns: Record<string, boolean>;
  message?: string;
  beautify?: boolean;
  transpose?: boolean;
  direction: Direction;
  hasLimit?: boolean;
  showValue?: boolean;
  cross: boolean;
  target?: 'export';
  /** Editor tab that started this run (for SQL error markers). */
  editorId?: string;
  /** Range of `stmt` in the editor document when run from a selection/full buffer. */
  sourceRange?: SqlSourceRange;
};
export type EditorContextType = {
  id: string;
  dbId: string;
  schema?: string;
  tableId?: string;
  type: string;
  displayName: string;
  docId?: string;
  /**
   * Absolute path on disk.
   * - Local SQL folder files: user-chosen path
   * - Scratch (temporary) editors: `{app_data}/scratch/{id}.sql`
   * - Legacy: may be absent until migration
   */
  path?: string;
};

export type TableContextType = {
  id: string;
  dbId: string;
  schema?: string;
  tableId: string;
  type: string;
  extra?: unknown;
  tableName?: string;
  displayName: string;
};

export type SchemaContextType = {
  id: string;
  dbId: string;
  schema: string;
  path?: string;

  type: string;
  displayName: string;
};

export type SearchContextType = {
  id: string;
  dbId: string;
  path?: string;
  value?: string;

  type: string;
  displayName: string;
};

export type TabContextType =
  | SearchContextType
  | SchemaContextType
  | TableContextType
  | EditorContextType
  | QueryContextType;

interface TabsState {
  /** Flat tab order derived from layout (for sidebar / compat). */
  ids: string[];
  tabs: Record<string, TabContextType>;
  currentId?: string | null;
  layout: PaneNode;
  focusedPaneId: PaneId;
}

type TabsAction = {
  append: (tab: TabContextType) => void;
  update: (tab: TabContextType) => void;
  setSession: (tab: TabContextType) => void;
  patch: (id: string, partial: Partial<TabContextType>) => void;
  remove: (key: string, force?: boolean) => void;
  removeOther: (key: string) => void;
  active: (idx: string) => void;
  focusPane: (paneId: PaneId) => void;
  split: (tabId: string, direction: SplitDirection) => void;
  moveTab: (tabId: string, toPaneId: PaneId, index?: number) => void;
  /** Merge or split-drop a tab onto a pane body zone. */
  dropOnPane: (
    tabId: string,
    targetPaneId: PaneId,
    zone: PaneDropZone,
  ) => void;
  setPaneSizes: (splitId: PaneId, sizes: [number, number]) => void;
};

function withDerivedIds(
  layout: PaneNode,
  focusedPaneId: PaneId,
  extra?: Partial<TabsState>,
): Pick<TabsState, 'ids' | 'layout' | 'focusedPaneId' | 'currentId'> &
  Partial<TabsState> {
  const focus = resolveFocusedPaneId(layout, focusedPaneId);
  return {
    layout,
    focusedPaneId: focus,
    ids: collectTabIds(layout),
    currentId: resolveCurrentId(layout, focus),
    ...extra,
  };
}

const defaultLeaf = createDefaultLayout();

export const useTabsStore = create<TabsState & TabsAction>()(
  // immer(
  persist(
    (set, _get) => ({
      ids: [],
      tabs: {},
      currentId: null,
      layout: defaultLeaf,
      focusedPaneId: defaultLeaf.id,
      append: (tab: TabContextType) =>
        set((state) => {
          if (state.ids.includes(tab.id)) {
            return {
              tabs: { ...state.tabs, [tab.id]: tab },
            };
          }
          const focus = resolveFocusedPaneId(state.layout, state.focusedPaneId);
          const layout = updateLeaf(state.layout, focus, (leaf) =>
            addTabToLeaf(leaf, tab.id, false),
          );
          return {
            tabs: { ...state.tabs, [tab.id]: tab },
            ...withDerivedIds(layout, focus),
          };
        }),
      active: (id) =>
        set((state) => {
          const leaf = findLeafByTab(state.layout, id);
          if (!leaf) {
            return { currentId: id };
          }
          const layout = updateLeaf(state.layout, leaf.id, (l) =>
            addTabToLeaf(l, id, true),
          );
          return withDerivedIds(layout, leaf.id);
        }),
      update: (item: TabContextType) => {
        set((state) => {
          const existingLeaf = findLeafByTab(state.layout, item.id);
          const focus = existingLeaf
            ? existingLeaf.id
            : resolveFocusedPaneId(state.layout, state.focusedPaneId);
          const layout = existingLeaf
            ? updateLeaf(state.layout, existingLeaf.id, (leaf) =>
                addTabToLeaf(leaf, item.id, true),
              )
            : updateLeaf(state.layout, focus, (leaf) =>
                addTabToLeaf(leaf, item.id, true),
              );
          const derived = withDerivedIds(layout, focus);
          // Preserve ids reference when order unchanged (upsert existing tab).
          const sameIds =
            derived.ids.length === state.ids.length &&
            derived.ids.every((id, i) => id === state.ids[i]);
          return {
            tabs: { ...state.tabs, [item.id]: item },
            ...derived,
            ids: sameIds ? state.ids : derived.ids,
          };
        });
      },
      setSession: (item: TabContextType) => {
        set((state) => {
          if (!state.ids.includes(item.id)) {
            return state;
          }
          return {
            tabs: {
              ...state.tabs,
              [item.id]: item,
            },
          };
        });
      },
      patch: (id, partial) => {
        set((state) => {
          const prev = state.tabs[id];
          if (!prev) {
            return state;
          }
          return {
            tabs: {
              ...state.tabs,
              [id]: { ...prev, ...partial } as TabContextType,
            },
          };
        });
      },
      remove: (key, force) => {
        let clearSession = false;
        set((state) => {
          const { layout } = removeTabFromLayout(state.layout, key);

          const nextTabs = shake(state.tabs, (a) => {
            return a.id == key && (a.type != 'editor' || !!force);
          });

          clearSession = !(key in nextTabs);

          // Soft-closed editors stay in tabs map but leave layout (ids).
          const focus = resolveFocusedPaneId(layout, state.focusedPaneId);
          return {
            tabs: nextTabs,
            ...withDerivedIds(layout, focus),
          };
        });
        // Side effects after set — keep updater pure.
        if (clearSession) {
          useQuerySessionStore.getState().clearEditor(key);
        }
      },
      removeOther: (key) => {
        let clearedIds: string[] = [];
        set((state) => {
          const nextTabs = shake(state.tabs, (a) => {
            return a.id != key && a.type != 'editor';
          });
          clearedIds = Object.keys(state.tabs).filter(
            (id) => !(id in nextTabs) && id !== key,
          );
          const leaf = createDefaultLayout([key], key);
          return {
            tabs: nextTabs,
            ...withDerivedIds(leaf, leaf.id),
          };
        });
        const session = useQuerySessionStore.getState();
        for (const id of clearedIds) {
          session.clearEditor(id);
        }
      },
      focusPane: (paneId) =>
        set((state) => {
          if (!findLeaf(state.layout, paneId)) {
            return state;
          }
          return withDerivedIds(state.layout, paneId);
        }),
      split: (tabId, direction) =>
        set((state) => {
          const leaf = findLeafByTab(state.layout, tabId);
          if (!leaf) {
            return state;
          }
          const result = splitLeaf(state.layout, leaf.id, tabId, direction);
          if (!result) {
            return state;
          }
          return withDerivedIds(result.layout, result.newPaneId);
        }),
      moveTab: (tabId, toPaneId, index) =>
        set((state) => {
          if (!findLeafByTab(state.layout, tabId) || !findLeaf(state.layout, toPaneId)) {
            return state;
          }
          const layout = moveTabInLayout(state.layout, tabId, toPaneId, index);
          if (layout === state.layout) {
            return state;
          }
          const target = findLeaf(layout, toPaneId);
          const focus = target?.tabIds.includes(tabId)
            ? toPaneId
            : resolveFocusedPaneId(layout, state.focusedPaneId);
          const withActive =
            target && target.tabIds.includes(tabId)
              ? updateLeaf(layout, toPaneId, (l) =>
                  addTabToLeaf(l, tabId, true),
                )
              : layout;
          return withDerivedIds(withActive, focus);
        }),
      dropOnPane: (tabId, targetPaneId, zone) =>
        set((state) => {
          if (!findLeafByTab(state.layout, tabId)) {
            return state;
          }
          const result = dropTabOnPane(
            state.layout,
            tabId,
            targetPaneId,
            zone,
          );
          if (!result) {
            return state;
          }
          return withDerivedIds(result.layout, result.focusPaneId);
        }),
      setPaneSizes: (splitId, sizes) =>
        set((state) => ({
          layout: setSplitSizes(state.layout, splitId, sizes),
        })),
    }),
    {
      name: 'tabs',
      // Persist to app data dir tabs.json (Tauri); falls back to localStorage on web.
      storage: createJSONStorage(() => tabsFileStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TabsState>;
        const ids = p.ids ?? current.ids ?? [];
        const tabs = p.tabs ?? current.tabs ?? {};
        const currentId = p.currentId ?? current.currentId ?? null;

        if (p.layout && p.focusedPaneId) {
          const synced = syncLayoutWithIds(
            p.layout,
            ids.length ? ids : collectTabIds(p.layout),
            currentId,
            p.focusedPaneId,
          );
          return {
            ...current,
            ...p,
            tabs,
            ...synced,
          };
        }

        const leaf = createDefaultLayout(ids, currentId);
        return {
          ...current,
          ...p,
          tabs,
          ...withDerivedIds(leaf, leaf.id),
        };
      },
    },
  ),
  // ),
);

export function getTable(dbId: string, tableId: string) {
  return getTableMap().get(dbId)?.get(tableId);
}

export function getDatabase(dbId?: string) {
  if (!isEmpty(dbId)) {
    return getDbMap().get(dbId!);
  }
}

export async function getParams(
  ctx: QueryParamType,
): Promise<QueryParams | QueryTableParams | undefined> {
  const {
    page = 1,
    perPage = 500,
    sqlWhere,
    sqlOrderBy,
    stmt,
    dbId,
    tableId,
  } = ctx;

  const db = getDatabase(ctx?.dbId);
  if (!db && ctx.type != 'file') {
    throw new Error('No connection found');
  }

  await whenRegistryReady();

  let dialect: DialectRef;
  if (ctx.type == 'file') {
    dialect = {
      path: tableId,
      dialect: 'file',
    } as DialectRef;
  } else {
    // Frontend only sends connection id; backend registry holds credentials.
    dialect = connectionRef(dbId);
  }

  const param = {
    limit: perPage,
    offset: (page - 1) * perPage,
  };

  if (stmt) {
    return {
      dialect,
      sql: stmt,
      ...param,
    };
  }
  const table = getTable(dbId, tableId);

  let tableName = ctx.tableName ?? table?.path ?? tableId;

  if (db?.dialect === 'postgres' && table?.path) {
    dialect = connectionRef(dbId, {
      database: table.path.split('.')[0],
    });
  }

  if (tableName.endsWith('.csv')) {
    const csv = useSettingStore.getState().csv;
    const params = [`'${tableName}'`, 'auto_detect=true, union_by_name=true'];
    for (const [key, val] of Object.entries(csv ?? {})) {
      if (!isEmpty(val)) {
        params.push(`${key}='${val}'`);
      }
    }
    tableName = `read_csv(${params.join(', ')})`;
  } else if (tableName.endsWith('.parquet')) {
    tableName = `read_parquet('${tableName}', union_by_name=true)`;
  } else if (tableName.endsWith('.xlsx')) {
    tableName = `read_xlsx('${tableName}', ignore_errors=true, all_varchar=true)`;
  } else if (tableName.endsWith('.json')) {
    tableName = `read_json('${tableName}', union_by_name=true)`;
  } else if (tableName.endsWith('.jsonl')) {
    tableName = `read_json('${tableName}', union_by_name=true)`;
  }

  return {
    dialect,
    table: tableName,
    where: sqlWhere,
    orderBy: sqlOrderBy,
    ...param,
  };
}

export async function execute(
  ctx: QueryParamType,
  options?: { requestId?: string },
): Promise<ResultType | undefined> {
  const param = await getParams(ctx);
  if (!param) {
    return;
  }
  const requestId = options?.requestId;
  let data;
  if (!ctx.stmt) {
    data = await queryTable({
      ...(param as QueryTableParams),
      ...(requestId ? { requestId } : {}),
    });
  } else {
    data = await query({
      ...(param as QueryParams),
      ...(requestId ? { requestId } : {}),
    });
  }

  console.log('data:', data);
  if (isQueryErrorCode(data?.code) && data?.message) {
    toast.warning(data.message);
  }
  return data;
}

export async function executeSQL(
  ctx: QueryParamType,
  options?: { requestId?: string },
): Promise<ResultType | undefined> {
  const param = await getParams(ctx);
  if (!param) {
    return;
  }

  const requestId = options?.requestId ?? nanoid();
  const withId = { ...(param as QueryParams), requestId };
  const func = ctx.hasLimit ? pagingQuery : query;
  const data = await func(withId);

  console.log('data:', data);
  // Non-zero codes (sql/cancelled/unsupported/…) — caller may toast.
  if (isQueryErrorCode(data?.code) && data?.message) {
    // toast handled by caller when needed
  }
  return data;
}

/** Cancel a running SQL query started with the given requestId. */
export async function cancelExecuteSQL(requestId: string): Promise<boolean> {
  return cancelQuery(requestId);
}

type ExportTarget = {
  type?: 'csv';
  file: string;
};

export async function exportData(
  { file }: ExportTarget,
  ctx: QueryParamType,
): Promise<void> {
  const param = (await getParams(ctx)) as QueryParams;
  if (param) {
    await exportCsv({
      file,
      dbId: ctx.dbId,
      ...param,
    });
  }
}
