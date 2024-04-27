import { NodeElementType, TreeNode } from '@/types';
import { StoreApi, useStore } from 'zustand';
import { DBType } from './dbList';

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never;

export const createSelectors = <S extends StoreApi<object>>(_store: S) => {
  const store = _store as WithSelectors<typeof _store>;
  store.use = {};
  for (const k of Object.keys(store.getState())) {
    (store.use as any)[k] = () =>
      useStore(_store, (s) => s[k as keyof typeof s]);
  }
  return store;
};

export function convertId(
  data: TreeNode,
  dbId: string,
  displayName?: string,
): NodeElementType {
  data.children = data?.children?.map((item) => convertId(item, dbId));
  return {
    id: `${dbId}:${data.path}`,
    dbId,
    icon: data.type ?? 'file',
    ...data,
    displayName,
  } as NodeElementType;
}

export type Node3Type = { data: NodeElementType; name: string; children?: string[] };

export function convertData(dbList: DBType[]): Record<string, Node3Type> {
  const tmp = {
    id: '__root__',
    children: dbList.map((db) => ({
      ...convertId(db.data, db.id, db.displayName),
      icon: db.dialect,
    })),
  } as NodeElementType;

  const res: Record<string, Node3Type> = {};

  const dfs = (item: NodeElementType) => {
    res[item.id] = {
      data: item,
      name: item.name,
      children: item.children?.map((t) => {
        dfs(t);
        return t.id;
      }),
    };
  };

  dfs(tmp);

  return res;
}
