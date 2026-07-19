import { nanoid } from 'nanoid';
import { isEmpty, shake } from 'radash';
import { toast } from 'sonner';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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

import { connectionRef, type DialectRef } from '@/lib/connectionRef';

import { Direction, SchemaType } from './dataset';
import { getDbMap, getTableMap, whenRegistryReady } from './dbList';
import { useQuerySessionStore } from './querySession';
import { useSettingStore } from './setting';

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
};
export type EditorContextType = {
  id: string;
  dbId: string;
  schema?: string;
  tableId?: string;
  type: string;
  displayName: string;
  docId?: string;
  /** Absolute path when opened from a local SQL folder; absent for scratch editors. */
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
  ids: string[];
  tabs: Record<string, TabContextType>;
  currentId?: string | null;
}

type TabsAction = {
  append: (tab: TabContextType) => void;
  update: (tab: TabContextType) => void;
  setSession: (tab: TabContextType) => void;
  patch: (id: string, partial: Partial<TabContextType>) => void;
  remove: (key: string, force?: boolean) => void;
  removeOther: (key: string) => void;
  active: (idx: string) => void;
};

export const useTabsStore = create<TabsState & TabsAction>()(
  // immer(
  persist(
    (set, _get) => ({
      ids: [],
      tabs: {},
      currentId: null,
      append: (tab: TabContextType) =>
        set((state) => {
          if (state.ids.includes(tab.id)) {
            return {
              tabs: { ...state.tabs, [tab.id]: tab },
            };
          }
          return {
            tabs: { ...state.tabs, [tab.id]: tab },
            ids: [...state.ids, tab.id],
          };
        }),
      active: (id) => set({ currentId: id }),
      update: (item: TabContextType) => {
        set((state) => {
          const exists = state.ids.includes(item.id);
          return {
            tabs: { ...state.tabs, [item.id]: item },
            ids: exists ? state.ids : [...state.ids, item.id],
            currentId: item.id,
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
          const ids = state.ids;
          let cur = state.currentId;
          const delIndex = ids.findIndex((id) => id === key);
          const updatedIds =
            delIndex < 0
              ? ids
              : ids.filter((_tab, index) => index !== delIndex);

          if (key == cur && delIndex >= 0) {
            cur = ids[delIndex - 1] || ids[delIndex + 1] || undefined;
          }

          const nextTabs = shake(state.tabs, (a) => {
            return a.id == key && (a.type != 'editor' || !!force);
          });

          clearSession = !(key in nextTabs);

          return {
            ids: updatedIds,
            tabs: nextTabs,
            currentId: cur,
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
          return {
            ids: [key],
            tabs: nextTabs,
            currentId: key,
          };
        });
        const session = useQuerySessionStore.getState();
        for (const id of clearedIds) {
          session.clearEditor(id);
        }
      },
    }),
    {
      name: 'tabs',
      storage: createJSONStorage(() => localStorage),
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
  if (data?.code && data.code !== 0 && data?.message) {
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
  // 401 legacy; also surface cancelled / unsupported via non-zero codes
  if (data?.code && data.code !== 0 && data?.message) {
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
