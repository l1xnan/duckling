import {
  DatasetAction,
  DatasetState,
  createDatasetStore,
} from '@/stores/dataset';
import { TabContextType } from '@/stores/tabs';
import { PropsWithChildren, createContext, useContext, useRef } from 'react';
import { StoreApi, useStore } from 'zustand';

export const PageContext = createContext<ReturnType<
  typeof createDatasetStore
> | null>(null);

export const PageProvider = ({
  context,
  children,
}: PropsWithChildren<{
  context: TabContextType;
}>) => {
  const storeRef = useRef<StoreApi<DatasetState & DatasetAction>>();
  if (!storeRef.current) {
    storeRef.current = createDatasetStore(context);
  }
  // const storeRef = useRef(createDatasetStore(context));
  return (
    <PageContext.Provider value={storeRef.current}>
      {children}
    </PageContext.Provider>
  );
};

export const usePageStore = () => {
  const store = useContext(PageContext);
  if (store === null) {
    throw new Error('no provider');
  }
  return useStore(store);
};
