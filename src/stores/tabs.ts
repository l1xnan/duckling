import { atom } from 'jotai';
import { focusAtom } from 'jotai-optics';
import { atomWithStore } from 'jotai-zustand';
import { atomFamily } from 'jotai/utils';
import { isEmpty, shake } from 'radash';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
  elapsed: number;

  data?: unknown[];
  sql?: string;
  titles?: TitleType[];
  tableSchema?: SchemaType[];
  message?: string;
  beautify?: boolean;
  transpose?: boolean;
  hasLimit?: boolean;
  showValue?: boolean;

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
  ids: string[];
  tabs: Record<string, TabContextType>;
  currentId?: string;
}

type TabsAction = {
  append: (tab: TabContextType) => void;
  update: (tab: TabContextType) => void;
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
      append: (tab: TabContextType) =>
        set((state) => ({
          tabs: { ...state.tabs, [tab.id]: tab },
          ids: [...state.ids, tab.id],
        })),
      active: (id) =>
        set(() => {
          return { currentId: id };
        }),
      update: (item: TabContextType) => {
        set((state) => {
          const { ids, tabs } = state;
          if (ids.findIndex((id) => id === item.id) < 0) {
            tabs[item.id] = item;
            ids.push(item.id);
          }
          return {
            tabs,
            ids,
            currentId: item.id,
          };
        });
      },
      remove: (key, force) => {
        set((state) => {
          const ids = state.ids;
          let cur = state.currentId;
          const delIndex = ids.findIndex((id) => id === key);
          const updatedIds = ids.filter((_tab, index) => {
            return index !== delIndex;
          });

          if (key == cur) {
            cur = ids[delIndex - 1] || ids[delIndex + 1] || undefined;
          }

          return {
            ids: updatedIds,
            tabs: shake(state.tabs, (a) => {
              return a.id == key && (a.type != 'editor' || !!force);
            }),
            currentId: cur,
          };
        });
      },
      removeOther: (key) => {
        set((state) => {
          return {
            ids: [key],
            tabs: shake(state.tabs, (a) => {
              return a.id != key && a.type != 'editor';
            }),
            currentId: key,
          };
        });
      },
    }),
    {
      name: 'tabs',
      storage: createJSONStorage(() => localStorage),
    },
  ),
  // ),
);

export const tabsStoreAtom = atomWithStore(useTabsStore);
export const activeTabAtom = focusAtom(tabsStoreAtom, (o) =>
  o.prop('currentId'),
);

export const tabObjAtom = focusAtom(tabsStoreAtom, (o) => o.prop('tabs'));

export const useTabsAtom = (objAtom: typeof tabObjAtom, key: string) => {
  return useMemo(() => {
    return focusAtom(objAtom, (optic) => optic.prop(key));
  }, [objAtom, key]);
};

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
