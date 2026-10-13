import { Trans, useLingui } from '@lingui/react/macro';
import { Columns3CogIcon, RefreshCw } from 'lucide-react';
import { isEmpty } from 'radash';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { find, listFiles, showColumns, showSchema } from '@/api';
import { SearchInput } from '@/components/custom/search';
import { TooltipButton } from '@/components/custom/tooltip';
import { Label } from '@/components/custom/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loading } from '@/components/views/TableView';
import { connectionRef } from '@/lib/connectionRef';
import { fileListDefaults, schemaTableDefaultsFor, sizeColumnFormatters } from '@/lib/schemaColumns';
import { useConnection } from '@/stores/dbList';
import { useDbSearchHistoryStore } from '@/stores/dbSearchHistory';
import { SchemaContextType, TableContextType, useTabsStore } from '@/stores/tabs';

import { SimpleTable } from '../tables/CanvasTable';
import { Button } from '../ui/button';

function getRowField(row: Record<string, unknown>, ...keys: string[]): string | undefined {
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

/** Last path segment, so a file row can name its tab after the file itself. */
function baseName(value: string): string {
  const parts = value.split(/[\\/]/);
  return parts[parts.length - 1] || value;
}

function resolveTableId(row: Record<string, unknown>, schema?: string): string | undefined {
  const name = getRowField(
    row,
    'table_name',
    'TABLE_NAME',
    'name',
    'Name',
    'NAME',
    'filename',
  );
  if (!name) return undefined;

  const tableSchema =
    getRowField(row, 'table_schema', 'TABLE_SCHEMA', 'schema', 'Schema') ?? schema;

  if (tableSchema && !name.includes('.')) {
    return `${tableSchema}.${name}`;
  }
  return name;
}

function useSchemaTableState(data: unknown[], defaultHiddenColumns: Record<string, boolean> = {}) {
  const [hiddenOverrides, setHiddenOverrides] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  const columnKeys = useMemo(() => Object.keys((data[0] as Record<string, unknown>) ?? {}), [data]);

  const hiddenColumns = useMemo(
    () => ({ ...defaultHiddenColumns, ...hiddenOverrides }),
    [defaultHiddenColumns, hiddenOverrides],
  );

  const setHiddenColumns = useCallback((col: string, hidden: boolean) => {
    setHiddenOverrides((prev) => ({ ...prev, [col]: hidden }));
  }, []);

  const filtered = useMemo(
    () =>
      data.filter((item) => {
        if (isEmpty(search)) {
          return true;
        }

        const match = Object.entries(item ?? {}).filter(([key, val]) => {
          return key.toLocaleLowerCase().includes('name') && String(val).includes(search);
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
  const history = useDbSearchHistoryStore((s) => s.terms);
  const pushHistory = useDbSearchHistoryStore((s) => s.push);
  const removeHistory = useDbSearchHistoryStore((s) => s.remove);
  const clearHistory = useDbSearchHistoryStore((s) => s.clear);

  const commitSearch = (term: string) => {
    const text = term.trim();
    if (!text) {
      return;
    }
    onSearchChange(text);
    pushHistory(text);
  };

  return (
    <div className="h-8 flex flex-row items-center gap-1 px-1">
      <SearchInput
        value={search}
        onChange={(e) => {
          onSearchChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commitSearch(search);
          }
        }}
        className="h-7 w-80 shrink-0 border"
        history={{
          terms: history,
          ariaLabel: t`Recent searches`,
          recentLabel: t`Recent searches`,
          emptyLabel: t`No recent searches`,
          onSelect: commitSearch,
          onRemove: removeHistory,
          onClear: clearHistory,
        }}
      />

      <div className="flex items-center">
        {columnKeys.length > 0 ? (
          <Popover>
            <PopoverTrigger
              render={<TooltipButton icon={<Columns3CogIcon />} tooltip={t`Hidden Column`} />}
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

export function DatabaseSchemaView({ context }: { context: SchemaContextType }) {
  const currentTab = useTabsStore((s) => s.currentId);
  const updateTab = useTabsStore((s) => s.update);
  const connection = useConnection(context.dbId);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<unknown[]>([]);

  const { rows, defaultHiddenColumns, sizeColumns } = useMemo(() => {
    const defaults = context.files
      ? fileListDefaults(data)
      : schemaTableDefaultsFor(connection?.dialect, data);
    if (!defaults) {
      return { rows: data, defaultHiddenColumns: {}, sizeColumns: [] };
    }
    return {
      rows: defaults.data,
      defaultHiddenColumns: defaults.hiddenColumns,
      sizeColumns: defaults.sizeColumns,
    };
  }, [context.files, connection?.dialect, data]);

  const fieldFormatters = useMemo(() => sizeColumnFormatters(sizeColumns), [sizeColumns]);

  const { search, setSearch, filtered, columnKeys, hiddenColumns, setHiddenColumns } =
    useSchemaTableState(rows, defaultHiddenColumns);

  const handleQuery = async () => {
    try {
      setLoading(true);
      const dialect = connectionRef(context.dbId);
      const { data } = context.files
        ? await listFiles(context.schema as string, dialect)
        : await showSchema(context.schema as string, dialect);
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

  const { t } = useLingui();

  const handleOpenTable = useCallback(
    (row: Record<string, unknown>) => {
      const tableId = resolveTableId(row, context.schema);
      if (!tableId) {
        toast.error(t`Cannot resolve table name from row`);
        return;
      }
      const name = getRowField(row, 'table_name', 'TABLE_NAME', 'name', 'Name') ?? tableId;
      const item: TableContextType = {
        id: `${context.dbId}:${tableId}`,
        dbId: context.dbId,
        tableId,
        displayName: baseName(name),
        type: 'table',
      };
      updateTab(item);
    },
    [context.dbId, context.schema, updateTab, t],
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
              fieldFormatters={fieldFormatters}
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

  const { search, setSearch, filtered, columnKeys, hiddenColumns, setHiddenColumns } =
    useSchemaTableState(data);

  const handleQuery = async () => {
    try {
      setLoading(true);
      const { data } = await showColumns(context.tableId as string, connectionRef(context.dbId));
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

  const { search, setSearch, filtered, columnKeys, hiddenColumns, setHiddenColumns } =
    useSchemaTableState(data);

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

  const { t } = useLingui();

  const handleOpenTable = useCallback(
    (row: Record<string, unknown>) => {
      const tableId = resolveTableId(row);
      if (!tableId) {
        toast.error(t`Cannot resolve table name from row`);
        return;
      }
      const name = getRowField(row, 'table_name', 'TABLE_NAME', 'name', 'Name') ?? tableId;
      const item: TableContextType = {
        id: `${context.dbId}:${tableId}`,
        dbId: context.dbId,
        tableId,
        displayName: baseName(name),
        type: 'table',
      };
      updateTab(item);
    },
    [context.dbId, updateTab, t],
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
