import { NodeElementType, TreeNode } from '@/types';
import { StoreApi, useStore } from 'zustand';

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
