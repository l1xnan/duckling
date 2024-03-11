import { useAtomValue } from 'jotai';
import { Loader2Icon } from 'lucide-react';
import {
  ReactNode,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import { showSchema } from '@/api';
import { cn } from '@/lib/utils';
import { PageContext, createDatasetStore } from '@/stores/dataset';
import {
  SchemaContextType,
  TabContextType,
  activeTabAtom,
  getDatabase,
} from '@/stores/tabs';

import { SimpleTable } from './CanvasTable';

export const Loading = ({ className }: { className?: string }) => {
  return (
    <Loader2Icon
      className={cn(
        'my-28 h-16 w-full text-primary/60 animate-spin',
        className,
      )}
    />
  );
};

export const PageProvider = ({
  context,
  children,
}: {
  context: TabContextType;
  children: ReactNode;
}) => {
  const storeRef = useRef(createDatasetStore(context));
  return (
    <PageContext.Provider value={storeRef.current}>
      {children}
    </PageContext.Provider>
  );
};

export const usePageStoreApi = () => {
  const store = useContext(PageContext);
  if (store === null) {
    throw new Error('no provider');
  }
  return store;
};

export function DatabaseSchema({ context }: { context: SchemaContextType }) {
  const currentTab = useAtomValue(activeTabAtom);
  const [loading, setLoading] = useState(false);
  const db = getDatabase(context?.dbId);

  const [data, setData] = useState<unknown[]>([]);

  useEffect(() => {
    if (currentTab?.id == context.id) {
      (async () => {
        try {
          setLoading(true);
          const { data } = await showSchema(
            context.schema as string,
            db.config,
          );
          setData(data);
        } catch (error) {
          toast.error((error as Error).message);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, []);

  return (
    <div className="h-full">
      <Suspense fallback={<Loading />}>
        {loading ? <Loading /> : <SimpleTable data={data ?? []} />}
      </Suspense>
    </div>
  );
}

export default DatabaseSchema;
