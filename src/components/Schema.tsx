import { useAtomValue } from 'jotai';
import { Loader2Icon, RefreshCw, Search } from 'lucide-react';
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
import { isEmpty } from '@/utils';

import { SimpleTable } from './CanvasTable';
import { Button } from './ui/button';
import { Input } from './ui/input';

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

  const handleQuery = async () => {
    try {
      setLoading(true);
      const { data } = await showSchema(context.schema as string, db.config);
      setData(data);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab?.id == context.id) {
      handleQuery();
    }
  }, []);
  const [search, setSearch] = useState('');

  return (
    <div className="h-full">
      <div className="h-[32px] flex flex-row justify-between">
        <div className="relative flex-1 ">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Search"
            className="w-full h-full pl-8 py-0.5 text-xs focus-visible:ring-0 shadow-none rounded-none border-t-0 border-b transition-none"
          />
        </div>

        <Button variant="link" size="icon" onClick={handleQuery}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="h-full">
        <Suspense fallback={<Loading />}>
          {loading ? (
            <Loading />
          ) : (
            <SimpleTable
              data={
                data.filter((item) => {
                  if (isEmpty(search)) {
                    return true;
                  }
                  if (item?.name) {
                    JSON.stringify(Object.values(item));
                    return item?.name?.includes(search);
                  }
                  return true;
                }) ?? []
              }
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}

export default DatabaseSchema;
