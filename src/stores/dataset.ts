import { DataType } from '@apache-arrow/ts';
import { nanoid } from 'nanoid';
import { createStore } from 'zustand';

import { ResultType, TitleType } from '@/api';
import { nextOrderBy, orderByClause } from '@/lib/sql/orderBy';

import {
  QueryParamType,
  TabContextType,
  TableContextType,
  cancelExecuteSQL,
  execute,
  getDatabase,
} from './tabs';

export type SchemaType = {
  name: string;
  dataType: DataType;
  nullable: boolean;
  metadata: unknown;
  type?: string;
};

export interface ArrowResponse {
  total: number;
  data: Array<number>;
  titles?: TitleType[];
  sql?: string;
  code: number;
  elapsed: number;
  message: string;
}
export type Direction = 'horizontal' | 'vertical';

export type DatasetState = {
  // current tab context(database, table, etc)
  context?: TabContextType;

  page: number;
  perPage: number;
  total: number;

  loading?: boolean;

  data: unknown[];
  tableSchema: SchemaType[];
  sql?: string;

  tableName?: string;
  code?: number;
  message?: string;
  elapsed?: number;

  titles?: TitleType[];
  orderBy?: OrderByType;
  sqlOrderBy?: string;
  sqlWhere?: string;
  beautify?: boolean;
  transpose?: boolean;
  cross?: boolean;
  showValue?: boolean;
  dialogColumn?: string;
  direction: Direction;
  hiddenColumns: Record<string, boolean>;
  /** In-flight refresh request id for cancel. */
  refreshRequestId?: string;
};

export type DatasetAction = {
  setStore?: (res: Partial<DatasetState>) => void;
  /**
   * Server-side sort by column.
   * - no options: toggle none → ASC → DESC → none
   * - `{ desc }` force direction
   * - `{ clear: true }` clear sort
   */
  setOrderBy?: (
    name: string,
    options?: { desc?: boolean; clear?: boolean },
  ) => void;
  setPagination?: (p: { page?: number; perPage?: number }) => void;
  setTranspose?: () => void;
  setCross?: () => void;
  setSQLWhere: (value: string) => void;
  setSQLOrderBy: (value: string) => void;
  setDialogColumn: (value: string) => void;
  setHiddenColumns: (key: string, value: boolean) => void;
  refresh: (stmt?: string) => Promise<ResultType | undefined>;
  /** Cancel the in-flight table refresh started by `refresh`. */
  cancelRefresh: () => Promise<void>;
  setBeautify: () => void;
  setShowValue: () => void;
  setDirection: () => void;
};

export type OrderByType = {
  name: string;
  desc: boolean;
};

export type StmtType = {
  tableName?: string;
  page?: number;
  perPage?: number;
  orderBy?: OrderByType;
  where?: string;
};

export const createDatasetStore = (context: TabContextType) =>
  createStore<DatasetState & DatasetAction>((set, get) => ({
    // state
    context,
    page: 1,
    perPage: 500,
    total: 0,
    tableSchema: [],
    data: [],
    loading: false,
    titles: [],
    sqlWhere: undefined,
    sqlOrderBy: undefined,
    code: 0,
    message: undefined,
    beautify: true,
    transpose: false,
    direction: 'horizontal',
    cross: false,
    hiddenColumns: {},

    // action
    setStore: (res: object) => set((_) => res),
    setBeautify: () => set((s) => ({ beautify: !s.beautify })),
    setTranspose: () => {
      set((s) => ({ transpose: !s.transpose }));
    },
    setDirection: () => {
      set((s) => ({
        direction: s.direction == 'horizontal' ? 'vertical' : 'horizontal',
      }));
    },
    setCross: () => {
      set((s) => ({ cross: !s.cross }));
    },

    setShowValue: () => {
      set((s) => ({ showValue: !s.showValue }));
    },

    setPagination: (p) => {
      set(() => ({ ...p }));
      get().refresh();
    },

    setSQLWhere: (value: string) => {
      set((_) => ({ sqlWhere: value }));
    },

    setSQLOrderBy: (value: string) => {
      // Manual ORDER BY text clears structured header sort state.
      set((_) => ({
        sqlOrderBy: value,
        orderBy: value.trim() ? undefined : get().orderBy,
      }));
    },
    setDialogColumn: (dialogColumn: string) => set((_) => ({ dialogColumn })),
    setHiddenColumns: (key: string, value: boolean) =>
      set(({ hiddenColumns }) => ({
        hiddenColumns: { ...hiddenColumns, [key]: value },
      })),

    setOrderBy: (name, options) => {
      const context = get().context as TableContextType | undefined;
      const dialect = getDatabase(context?.dbId)?.dialect ?? 'generic';

      if (options?.clear) {
        set({ orderBy: undefined, sqlOrderBy: '', page: 1 });
        void get().refresh();
        return;
      }

      let next: OrderByType | undefined;
      if (options && 'desc' in options && options.desc !== undefined) {
        next = { name, desc: !!options.desc };
      } else {
        next = nextOrderBy(get().orderBy, name);
      }

      if (!next) {
        set({ orderBy: undefined, sqlOrderBy: '', page: 1 });
      } else {
        set({
          orderBy: next,
          sqlOrderBy: orderByClause(next.name, next.desc, dialect),
          page: 1,
        });
      }
      void get().refresh();
    },

    refresh: async () => {
      const { page, perPage, sqlWhere, sqlOrderBy, orderBy } = get();
      const context = get().context as TableContextType;
      const requestId = nanoid();

      // Prefer structured orderBy when present (header click).
      let orderClause = sqlOrderBy;
      if (orderBy?.name) {
        const dialect = getDatabase(context?.dbId)?.dialect ?? 'generic';
        orderClause = orderByClause(orderBy.name, orderBy.desc, dialect);
      }

      const ctx: QueryParamType = {
        type: context?.type,
        dbId: context?.dbId,
        tableId: context?.tableId,
        tableName: context?.tableName,
        page,
        perPage,
        sqlWhere,
        sqlOrderBy: orderClause,
      };
      set({ loading: true, message: undefined, refreshRequestId: requestId });
      try {
        const data = await execute(ctx, { requestId });
        // Keep last known sql when the response omits it (e.g. older error paths).
        set({
          ...data,
          sql: data?.sql ?? get().sql,
          loading: false,
          refreshRequestId: undefined,
        });
        return data;
      } catch (e) {
        /* empty */
      } finally {
        if (get().refreshRequestId === requestId) {
          set({ loading: false, refreshRequestId: undefined });
        } else {
          set({ loading: false });
        }
      }
    },

    cancelRefresh: async () => {
      const rid = get().refreshRequestId;
      if (rid) {
        await cancelExecuteSQL(rid);
      }
    },
  }));
