import { Trans, useLingui } from '@lingui/react/macro';
import { Columns3CogIcon, RefreshCw, Search } from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { isEmpty } from 'radash';
import { toast } from 'sonner';

import { find, showColumns, showSchema } from '@/api';
import { TooltipButton } from '@/components/custom/tooltip';
import { Label } from '@/components/custom/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loading } from '@/components/views/TableView';
import { connectionRef } from '@/lib/connectionRef';
import {
  SchemaContextType,
  TableContextType,
  useTabsStore,
} from '@/stores/tabs';

import { SimpleTable } from '../tables/CanvasTable';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

function getRowField(
  row: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase() === lower && v != null && String(v).trim() !== '') {
        return String(v);
      }
    }
  }
  return undefined;
}

function resolveTableId(
  row: Record<string, unknown>,
  schema?: string,
): string | undefined {
  const name = getRowField(
    row,
    'table_name',
    'TABLE_NAME',
    'name',
    'Name',
    'NAME',
  );
  if (!name) return undefined;

  const tableSchema =
    getRowField(row, 'table_schema', 'TABLE_SCHEMA', 'schema', 'Schema') ??
    schema;

  if (tableSchema && !name.includes('.')) {
    return `${tableSchema}.${name}`;
  }
  return name;
}

function useSchemaTableState(data: unknown[]) {
  const [hiddenColumns, setHiddenColumnsState] = useState<
    Record<string, boolean>
  >({});
  const [search, setSearch] = useState('');

  const columnKeys = useMemo(
    () => Object.keys((data[0] as Record<string, unknown>) ?? {}),
    [data],
  );

  const setHiddenColumns = useCallback((col: string, hidden: boolean) => {
    setHiddenColumnsState((prev) => ({ ...prev, [col]: hidden }));
  }, []);

  const filtered = useMemo(
    () =>
      data.filter((item) => {
        if (isEmpty(search)) {
          return true;
        }

        const match = Object.entries(item ?? {}).filter(([key, val]) => {
          return (
            key.toLocaleLowerCase().includes('name') &&
            String(val).includes(search)
          );
        });

        return match.length > 0;
      }) ?? [],
    [data, search],
  );

  return {
    search,
    setSearch,
    filtered,
    columnKeys,
    hiddenColumns,
    setHiddenColumns,
  };
}

function SchemaToolbar({
  search,
  onSearchChange,
  onRefresh,
  columnKeys,
  hiddenColumns,
  setHiddenColumns,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onRefresh: () => void;
  columnKeys: string[];
  hiddenColumns: Record<string, boolean>;
  setHiddenColumns: (col: string, hidden: boolean) => void;
}) {
  const { t } = useLingui();

  return (
    <div className="h-8 flex flex-row justify-between items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            onSearchChange(e.target.value);
          }}
          placeholder={t`Search`}
          className="w-full h-full pl-8 py-0.5 text-xs focus-visible:ring-0 shadow-none rounded-none border-t-0 border-b transition-none"
        />
      </div>

      <div className="flex items-center">
        {columnKeys.length > 0 ? (
          <Popover>
            <PopoverTrigger
              render={
                <TooltipButton
                  icon={<Columns3CogIcon />}
                  tooltip={t`Hidden Column`}
                />
              }
            />
            <PopoverContent>
              <div className="flex flex-col gap-2">
                <h4>
                  <Trans>Data Columns</Trans>
                </h4>
                {columnKeys.map((name) => (
                  <div className="flex items-center gap-3" key={name}>
                    <Checkbox
                      id={`schema-col-${name}`}
                      checked={!hiddenColumns?.[name]}
                      onCheckedChange={(value) => {
                        setHiddenColumns(name, !value);
                      }}
                    />
                    <Label htmlFor={`schema-col-${name}`}>{name}</Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
        <Button variant="link" size="icon" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function DatabaseSchemaView({
  context,
}: {
  context: SchemaContextType;
}) {
  const currentTab = useTabsStore((s) => s.currentId);
  const updateTab = useTabsStore((s) => s.update);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<unknown[]>([]);

  const {
    search,
    setSearch,
    filtered,
    columnKeys,
    hiddenColumns,
    setHiddenColumns,
  } = useSchemaTableState(data);

  const handleQuery = async () => {
    try {
      setLoading(true);
      const { data } = await showSchema(
        context.schema as string,
        connectionRef(context.dbId),
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

  const handleOpenTable = useCallback(
    (row: Record<string, unknown>) => {
      const tableId = resolveTableId(row, context.schema);
      if (!tableId) {
        toast.error('Cannot resolve table name from row');
        return;
      }
      const name =
        getRowField(row, 'table_name', 'TABLE_NAME', 'name', 'Name') ?? tableId;
      const item: TableContextType = {
        id: `${context.dbId}:${tableId}`,
        dbId: context.dbId,
        tableId,
        displayName: name,
        type: 'table',
      };
      updateTab(item);
    },
    [context.dbId, context.schema, updateTab],
  );

  return (
    <div className="h-full flex flex-col">
      <SchemaToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={handleQuery}
        columnKeys={columnKeys}
        hiddenColumns={hiddenColumns}
        setHiddenColumns={setHiddenColumns}
      />
      <div className="h-full flex-1">
        <Suspense fallback={<Loading />}>
          {loading ? (
            <Loading />
          ) : (
            <SimpleTable
              data={filtered}
              hiddenColumns={hiddenColumns}
              setHiddenColumns={setHiddenColumns}
              onOpenTable={handleOpenTable}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}

export function ColumnSchemaView({ context }: { context: TableContextType }) {
  const currentTab = useTabsStore((s) => s.currentId);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<unknown[]>([]);

  const {
    search,
    setSearch,
    filtered,
    columnKeys,
    hiddenColumns,
    setHiddenColumns,
  } = useSchemaTableState(data);

  const handleQuery = async () => {
    try {
      setLoading(true);
      const { data } = await showColumns(
        context.tableId as string,
        connectionRef(context.dbId),
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

  return (
    <div className="h-full flex flex-col">
      <SchemaToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={handleQuery}
        columnKeys={columnKeys}
        hiddenColumns={hiddenColumns}
        setHiddenColumns={setHiddenColumns}
      />
      <div className="h-full flex-1">
        <Suspense fallback={<Loading />}>
          {loading ? (
            <Loading />
          ) : (
            <SimpleTable
              data={filtered}
              hiddenColumns={hiddenColumns}
              setHiddenColumns={setHiddenColumns}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}

export function SearchView({ context }: { context: TableContextType }) {
  const currentTab = useTabsStore((s) => s.currentId);
  const updateTab = useTabsStore((s) => s.update);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<unknown[]>([]);

  const {
    search,
    setSearch,
    filtered,
    columnKeys,
    hiddenColumns,
    setHiddenColumns,
  } = useSchemaTableState(data);

  const handleQuery = async () => {
    try {
      setLoading(true);
      const { data } = await find(
        (context as { value?: string }).value as string,
        (context as { path?: string }).path as string,
        connectionRef(context.dbId),
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

  const handleOpenTable = useCallback(
    (row: Record<string, unknown>) => {
      const tableId = resolveTableId(row);
      if (!tableId) {
        toast.error('Cannot resolve table name from row');
        return;
      }
      const name =
        getRowField(row, 'table_name', 'TABLE_NAME', 'name', 'Name') ?? tableId;
      const item: TableContextType = {
        id: `${context.dbId}:${tableId}`,
        dbId: context.dbId,
        tableId,
        displayName: name,
        type: 'table',
      };
      updateTab(item);
    },
    [context.dbId, updateTab],
  );

  return (
    <div className="h-full flex flex-col">
      <SchemaToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={handleQuery}
        columnKeys={columnKeys}
        hiddenColumns={hiddenColumns}
        setHiddenColumns={setHiddenColumns}
      />
      <div className="h-full flex-1">
        <Suspense fallback={<Loading />}>
          {loading ? (
            <Loading />
          ) : (
            <SimpleTable
              data={filtered}
              hiddenColumns={hiddenColumns}
              setHiddenColumns={setHiddenColumns}
              onOpenTable={handleOpenTable}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
