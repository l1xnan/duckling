import { atom } from 'jotai';
import { focusAtom } from 'jotai-optics';
import { atomWithStore } from 'jotai-zustand';
import { atomFamily, splitAtom } from 'jotai/utils';
import { debounce, isEmpty } from 'radash';
import { toast } from 'sonner';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import {
  QueryParams,
  QueryTableParams,
  ResultType,
  TitleType,
  exportCsv,
  pagingQuery,
  query,
  queryTable,
} from '@/api';
import { atomStore } from '@/stores';

import { SchemaType } from './dataset';
import { PostgresDialectType, dbMapAtom, tablesAtom } from './dbList';
import { settingAtom } from './setting';

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

  data?: unknown[];
  sql?: string;
  titles?: TitleType[];
  tableSchema?: SchemaType[];
  message?: string;
  beautify?: boolean;
  transpose?: boolean;
  hasLimit?: boolean;

  target?: 'export';
};
export type EditorContextType = {
  id: string;
  dbId: string;
  schema?: string;
  tableId?: string;
  type: string;
  displayName: string;
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

  type: string;
  displayName: string;
};

export type TabContextType =
  | SchemaContextType
  | TableContextType
  | EditorContextType
  | QueryContextType;

interface TabsState {
  tabs: TabContextType[];
  currentTab?: TabContextType;

  docs: Record<string, string>;
}

type TabsAction = {
  append: (tab: TabContextType) => void;
  update: (tab: TabContextType) => void;
  remove: (key: string) => void;
  removeOther: (key: string) => void;
  active: (idx: string) => void;

  setStmt: (key: string, value: string) => void;
};

export const useTabsStore = create<TabsState & TabsAction>()(
  immer(
    persist(
      (set, _get) => ({
        tabs: [],
        currentTab: undefined,
        docs: {},

        append: (tab: TabContextType) =>
          set((state) => ({ tabs: [...state.tabs, tab] })),
        active: (index) =>
          set((state) => {
            const idx = state.tabs.findIndex(({ id }) => id === index);
            return { currentTab: state.tabs[idx] };
          }),
        update: (item: TabContextType) => {
          set((state) => {
            let tabs = state.tabs;
            if (tabs.findIndex(({ id }) => id === item.id) < 0) {
              tabs = [...tabs, item];
            }
            return { currentTab: item, tabs };
          });
        },
        remove: (key) => {
          set((state) => {
            const tabs = state.tabs;
            let table = state.currentTab;
            const delIndex = tabs.findIndex(({ id }) => id === key);
            const updatedTabs = tabs.filter((_tab, index) => {
              return index !== delIndex;
            });

            if (key == table?.id) {
              table = tabs[delIndex - 1] || tabs[delIndex + 1] || undefined;
            }

            return {
              tabs: updatedTabs,
              currentTab: table,
            };
          });
        },
        removeOther: (key) => {
          set((state) => {
            return {
              tabs: state.tabs.filter((item) => item.id == key),
              currentTab: state.tabs.filter((item) => item.id == key)[0],
            };
          });
        },
        setStmt: debounce({ delay: 300 }, (key, stmt) => {
          set((s) => ({
            docs: { ...s.docs, [key]: stmt },
          }));
        }),
      }),
      {
        name: 'tabs',
        storage: createJSONStorage(() => localStorage),
      },
    ),
  ),
);

export const tabsAtom = atomWithStore(useTabsStore);
export const activeTabAtom = focusAtom(tabsAtom, (o) => o.prop('currentTab'));
export const tabListAtom = focusAtom(tabsAtom, (o) => o.prop('tabs'));

export const tabsAtomsAtom = splitAtom(tabListAtom);

export type SubTab = {
  id: string;
  activeKey?: string;
  children: QueryContextType[];
};

export const subTabsAtomFamily = atomFamily(
  (item: SubTab) => atom(item),
  (a: Partial<SubTab>, b: Partial<SubTab>) => a.id === b.id,
);

export function getTable(dbId: string, tableId: string) {
  const tableMap = atomStore.get(tablesAtom);
  return tableMap.get(dbId)?.get(tableId);
}

export function getDatabase(dbId?: string) {
  if (!isEmpty(dbId)) {
    const dbMap = atomStore.get(dbMapAtom);
    return dbMap.get(dbId!);
  }
}

export function getParams(
  ctx: QueryParamType,
): QueryParams | QueryTableParams | undefined {
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
  let dialect = db?.config;
  if (ctx.type == 'file') {
    dialect = {
      path: tableId,
      dialect: 'file',
    };
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

  if (dialect?.dialect == 'postgres') {
    (dialect as PostgresDialectType).database = table?.path.split(
      '.',
    )[0] as string;
  }

  if (tableName.endsWith('.csv')) {
    const csv = atomStore.get(settingAtom).csv;
    const params = [`'${tableName}'`, 'auto_detect=true, union_by_name=true'];
    for (const [key, val] of Object.entries(csv ?? {})) {
      if (!isEmpty(val)) {
        params.push(`${key}='${val}'`);
      }
    }
    tableName = `read_csv(${params.join(', ')})`;
  } else if (tableName.endsWith('.parquet')) {
    tableName = `read_parquet('${tableName}', union_by_name=true)`;
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
): Promise<ResultType | undefined> {
  const param = getParams(ctx);
  if (!param) {
    return;
  }
  let data;
  if (!ctx.stmt) {
    data = await queryTable(param as QueryTableParams);
  } else {
    data = await query(param as QueryParams);
  }

  console.log('data:', data);
  if (data?.code == 401 && data?.message) {
    toast.warning(data?.message);
  }
  return data;
}

export async function executeSQL(
  ctx: QueryParamType,
): Promise<ResultType | undefined> {
  const param = getParams(ctx);
  if (!param) {
    return;
  }

  const func = ctx.hasLimit ? pagingQuery : query;
  const data = await func(param as QueryParams);

  console.log('data:', data);
  if (data?.code == 401 && data?.message) {
    toast.warning(data?.message);
  }
  return data;
}

type ExportTarget = {
  type?: 'csv';
  file: string;
};

export async function exportData(
  { file }: ExportTarget,
  ctx: QueryParamType,
): Promise<ResultType | undefined> {
  // TODO: export table
  const param = getParams(ctx) as QueryParams;
  if (param) {
    const data = await exportCsv({
      file,
      ...param,
    });

    console.log('data:', data);
    if (data?.code == 401 && data?.message) {
      toast.warning(data?.message);
    }
    return data;
  }
}
