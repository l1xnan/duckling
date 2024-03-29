import { useAtomValue } from 'jotai';
import { RefreshCw, Search } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { find, showColumns, showSchema } from '@/api';
import { Loading } from '@/components/views/TableView';
import { DialectConfig } from '@/stores/dbList.ts';
import {
  SchemaContextType,
  TableContextType,
  activeTabAtom,
  getDatabase,
} from '@/stores/tabs';
import { isEmpty } from 'radash';

import { SimpleTable } from '../tables/CanvasTable';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export function DatabaseSchemaView({
  context,
}: {
  context: SchemaContextType;
}) {
  const currentTab = useAtomValue(activeTabAtom);
  const [loading, setLoading] = useState(false);
  const db = getDatabase(context?.dbId);

  const [data, setData] = useState<unknown[]>([]);

  const handleQuery = async () => {
    try {
      setLoading(true);
      const { data } = await showSchema(
        context.schema as string,
        db?.config as DialectConfig,
      );
      setData(data);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab == context.id) {
      handleQuery();
    }
  }, []);
  const [search, setSearch] = useState('');

  return (
    <div className="h-full flex flex-col">
      <div className="h-8 flex flex-row justify-between">
        <div className="relative flex-1">
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
      <div className="h-full flex-1">
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

                  const match = Object.entries(item ?? {}).filter(
                    ([key, val]) => {
                      return (
                        key.toLocaleLowerCase().includes('name') &&
                        String(val).includes(search)
                      );
                    },
                  );

                  return match.length > 0;
                }) ?? []
              }
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}

export function ColumnSchemaView({ context }: { context: TableContextType }) {
  const currentTab = useAtomValue(activeTabAtom);
  const [loading, setLoading] = useState(false);
  const db = getDatabase(context?.dbId);

  const [data, setData] = useState<unknown[]>([]);

  const handleQuery = async () => {
    try {
      setLoading(true);
      const { data } = await showColumns(
        context.tableId as string,
        db?.config as DialectConfig,
      );
      setData(data);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab == context.id) {
      handleQuery();
    }
  }, []);
  const [search, setSearch] = useState('');

  return (
    <div className="h-full flex flex-col">
      <div className="h-8 flex flex-row justify-between">
        <div className="relative flex-1">
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
      <div className="h-full flex-1">
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

                  const match = Object.entries(item ?? {}).filter(
                    ([key, val]) => {
                      return (
                        key.toLocaleLowerCase().includes('name') &&
                        String(val).includes(search)
                      );
                    },
                  );

                  return match.length > 0;
                }) ?? []
              }
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}

export function SearchView({ context }: { context: TableContextType }) {
  const currentTab = useAtomValue(activeTabAtom);
  const [loading, setLoading] = useState(false);
  const db = getDatabase(context?.dbId);

  const [data, setData] = useState<unknown[]>([]);

  const handleQuery = async () => {
    try {
      setLoading(true);
      const { data } = await find(
        context.value as string,
        context.path as string,
        db?.config as DialectConfig,
      );
      setData(data);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab == context.id) {
      handleQuery();
    }
  }, []);
  const [search, setSearch] = useState('');

  return (
    <div className="h-full flex flex-col">
      <div className="h-8 flex flex-row justify-between">
        <div className="relative flex-1">
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
      <div className="h-full flex-1">
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

                  const match = Object.entries(item ?? {}).filter(
                    ([key, val]) => {
                      return (
                        key.toLocaleLowerCase().includes('name') &&
                        String(val).includes(search)
                      );
                    },
                  );

                  return match.length > 0;
                }) ?? []
              }
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
