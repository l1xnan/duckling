import { createStore } from 'zustand';

import { ResultType, TitleType } from '@/api';

import {
  QueryParamType,
  TabContextType,
  TableContextType,
  execute,
} from './tabs';

export type SchemaType = {
  name: string;
  dataType: string;
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
};

export type DatasetAction = {
  setStore?: (res: Partial<DatasetState>) => void;
  setOrderBy?: (name: string) => void;
  setPagination?: (p: { page?: number; perPage?: number }) => void;
  setTranspose?: () => void;
  setCross?: () => void;
  setSQLWhere: (value: string) => void;
  setSQLOrderBy: (value: string) => void;
  setDialogColumn: (value: string) => void;
  refresh: (stmt?: string) => Promise<ResultType | undefined>;
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
      set((_) => ({ sqlOrderBy: value }));
    },
    setDialogColumn: (dialogColumn: string) => set((_) => ({ dialogColumn })),

    setOrderBy: (_name: string) => {},

    refresh: async () => {
      const { page, perPage, sqlWhere, sqlOrderBy } = get();
      const context = get().context as TableContextType;

      const ctx: QueryParamType = {
        type: context?.type,
        dbId: context?.dbId,
        tableId: context?.tableId,
        tableName: context?.tableName,
        page,
        perPage,
        sqlWhere,
        sqlOrderBy,
      };
      set({ loading: true });
      try {
        const data = await execute(ctx);
        set({ ...data, loading: false });
        return data;
      } catch (e) {
        /* empty */
      } finally {
        set({ loading: false });
      }
    },
  }));
