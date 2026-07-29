import { Data as ArrowDataType } from '@apache-arrow/ts';
import { Loader2Icon } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useDialog } from '@/components/custom/use-dialog';
import {
  sqlComparisonOperators,
  sqlWhereKeywords,
} from '@/components/editor/useRegister';
import { SingleLineEditor } from '@/components/editor/SingleLineEditor';
import { usePageStore } from '@/hooks/context';
import { buildQuickFilterWhere, filterRows } from '@/lib/filterRows';
import { quoteIdent } from '@/lib/sql/countByColumn';
import { buildCellPredicate, mergeWhere } from '@/lib/sql/drillDown';
import { cn } from '@/lib/utils';
import { SchemaType } from '@/stores/dataset';
import { getStoredDB } from '@/stores/dbList';
import { usePrecision } from '@/stores/setting';
import { TabContextType, TableContextType, useTabsStore } from '@/stores/tabs';

import { ColumnProfileDialog } from './ColumnProfileDialog';
import { CountByColumnDialog } from './CountByColumnDialog';
import { DataViewToolbar } from './DataViewToolbar';
import { PivotDialog } from './PivotDialog';
import { TableDataPanel } from './TableDataPanel';

export const Loading = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        'flex size-full items-center justify-center',
        className,
      )}
    >
      <Loader2Icon className="h-16 w-16 animate-spin text-primary/60" />
    </div>
  );
};

export type SelectedCellType = {
  value?: string | number | ArrowDataType;
  field?: string;
  col: number;
  row: number;
};

export function TableView({ context }: { context: TabContextType }) {
  const refresh = usePageStore((s) => s.refresh);
  const cancelRefresh = usePageStore((s) => s.cancelRefresh);
  const loading = usePageStore((s) => s.loading);
  const data = usePageStore((s) => s.data);
  const tableSchema = usePageStore((s) => s.tableSchema);
  const beautify = usePageStore((s) => s.beautify);
  const orderBy = usePageStore((s) => s.orderBy);
  const setOrderBy = usePageStore((s) => s.setOrderBy);
  const transpose = usePageStore((s) => s.transpose);
  const cross = usePageStore((s) => s.cross);
  const showValue = usePageStore((s) => s.showValue);
  const direction = usePageStore((s) => s.direction);
  const setShowValue = usePageStore((s) => s.setShowValue);
  const setDirection = usePageStore((s) => s.setDirection);
  const page = usePageStore((s) => s.page);
  const perPage = usePageStore((s) => s.perPage);
  const total = usePageStore((s) => s.total);
  const sql = usePageStore((s) => s.sql);
  const elapsed = usePageStore((s) => s.elapsed);
  const sqlWhere = usePageStore((s) => s.sqlWhere);
  const hiddenColumns = usePageStore((s) => s.hiddenColumns);
  const dialogColumn = usePageStore((s) => s.dialogColumn);
  const setBeautify = usePageStore((s) => s.setBeautify);
  const setPagination = usePageStore((s) => s.setPagination);
  const setTranspose = usePageStore((s) => s.setTranspose);
  const setHiddenColumns = usePageStore((s) => s.setHiddenColumns);
  const setCross = usePageStore((s) => s.setCross);
  const setDialogColumn = usePageStore((s) => s.setDialogColumn);
  const setSQLWhere = usePageStore((s) => s.setSQLWhere);

  const currentTab = useTabsStore((s) => s.currentId);
  const initialLoaded = useRef(false);

  useEffect(() => {
    if (currentTab == context.id && !initialLoaded.current) {
      (async () => {
        try {
          await refresh();
          initialLoaded.current = true;
        } catch (error) {
          toast.error((error as Error).message);
        }
      })();
    }
  }, [context.id, currentTab, refresh]);
  const precision = usePrecision();

  const countByDialog = useDialog();
  const profileDialog = useDialog();
  const pivotDialog = useDialog();
  const [resultFilter, setResultFilter] = useState('');
  const [profileColumn, setProfileColumn] = useState<string | undefined>();
  const [pivotRowField, setPivotRowField] = useState<string | undefined>();

  const columnNames = useMemo(
    () => (tableSchema ?? []).map((c) => c.name),
    [tableSchema],
  );

  const filteredData = useMemo(
    () =>
      filterRows(
        (data ?? []) as Record<string, unknown>[],
        resultFilter,
        columnNames,
      ),
    [data, resultFilter, columnNames],
  );

  const resolveDialect = useCallback(
    () =>
      getStoredDB(context.dbId)?.dialect ??
      ((context as TableContextType).type === 'file' ? 'file' : 'generic'),
    [context],
  );

  const handleApplyFilterToWhere = useCallback(() => {
    if (!resultFilter.trim() || !columnNames.length) return;
    const clause = buildQuickFilterWhere(
      columnNames,
      resultFilter,
      resolveDialect(),
      quoteIdent,
    );
    if (!clause) return;
    setSQLWhere(mergeWhere(sqlWhere, clause));
    void refresh();
  }, [
    columnNames,
    refresh,
    resolveDialect,
    resultFilter,
    setSQLWhere,
    sqlWhere,
  ]);

  const handleDrillDown = useCallback(
    (column: string, value: unknown) => {
      const predicate = buildCellPredicate(column, value, resolveDialect());
      setSQLWhere(mergeWhere(sqlWhere, predicate));
      void refresh();
    },
    [refresh, resolveDialect, setSQLWhere, sqlWhere],
  );

  const handleCancel = useCallback(async () => {
    try {
      await cancelRefresh();
    } catch (e) {
      console.error(e);
    }
  }, [cancelRefresh]);

  const handleCountByColumn = useCallback(
    (col?: string) => {
      if (!col) return;
      setDialogColumn(col);
      countByDialog.trigger();
    },
    [countByDialog, setDialogColumn],
  );

  const handleProfileColumn = useCallback(
    (col?: string) => {
      if (!col) return;
      setProfileColumn(col.replace(/\s*[↑↓]\s*$/, '').trim());
      profileDialog.trigger();
    },
    [profileDialog],
  );

  const handlePivotColumn = useCallback(
    (col?: string) => {
      if (!col) return;
      setPivotRowField(col.replace(/\s*[↑↓]\s*$/, '').trim());
      pivotDialog.trigger();
    },
    [pivotDialog],
  );

  const handleOrderByColumn = useCallback(
    (
      col?: string,
      options?: { desc?: boolean; clear?: boolean },
    ) => {
      if (!col || !setOrderBy) return;
      const name = col.replace(/\s*[↑↓]\s*$/, '').trim();
      setOrderBy(name, options);
    },
    [setOrderBy],
  );

  const tableContext = context as TableContextType;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <DataViewToolbar
        context={tableContext}
        dbId={context.dbId}
        length={filteredData.length}
        page={page}
        perPage={perPage}
        total={total}
        sql={sql}
        elapsed={elapsed}
        cross={cross}
        transpose={transpose}
        columns={tableSchema}
        hiddenColumns={hiddenColumns}
        setHiddenColumns={setHiddenColumns}
        resultFilter={resultFilter}
        onResultFilterChange={setResultFilter}
        onApplyFilterToWhere={handleApplyFilterToWhere}
        setShowValue={setShowValue}
        refresh={refresh}
        setBeautify={setBeautify}
        setPagination={setPagination}
        setTranspose={setTranspose}
        setCross={setCross}
        loading={loading}
        onCancel={handleCancel}
        onPivot={() => {
          setPivotRowField(undefined);
          pivotDialog.trigger();
        }}
      />
      <TableDataPanel
        loading={loading}
        data={filteredData}
        schema={tableSchema ?? []}
        hiddenColumns={hiddenColumns}
        setHiddenColumns={setHiddenColumns}
        beautify={beautify}
        orderBy={orderBy}
        precision={precision}
        transpose={transpose}
        cross={cross}
        showValue={showValue}
        direction={direction}
        setShowValue={setShowValue}
        setDirection={setDirection}
        onCountByColumn={handleCountByColumn}
        onProfileColumn={handleProfileColumn}
        onPivotColumn={handlePivotColumn}
        onOrderByColumn={handleOrderByColumn}
        onDrillDown={handleDrillDown}
        beforeTable={
          <InputToolbar context={tableContext} schema={tableSchema ?? []} />
        }
      />
      <CountByColumnDialog
        {...countByDialog.props}
        column={dialogColumn}
        context={tableContext}
        sqlWhere={sqlWhere}
      />
      <ColumnProfileDialog
        {...profileDialog.props}
        column={profileColumn}
        context={tableContext}
        sqlWhere={sqlWhere}
      />
      <PivotDialog
        {...pivotDialog.props}
        columns={tableSchema ?? []}
        context={tableContext}
        sqlWhere={sqlWhere}
        initialRowField={pivotRowField}
      />
    </div>
  );
}

const TMP_TABLE_NAME = '__tmp__';

export const InputToolbar = memo(function InputToolbar({
  context: _context,
  schema,
}: {
  context: TableContextType;
  schema: SchemaType[];
}) {
  const setSQLWhere = usePageStore((s) => s.setSQLWhere);
  const setSQLOrderBy = usePageStore((s) => s.setSQLOrderBy);
  const refresh = usePageStore((s) => s.refresh);
  const sqlWhere = usePageStore((s) => s.sqlWhere);
  const sqlOrderBy = usePageStore((s) => s.sqlOrderBy);

  const handleEnterDown = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const columnMeta = useMemo(
    () => schema.map(({ name, type }) => ({ name, type: type ?? '' })),
    [schema],
  );

  const completeMetaBase = useMemo(
    () => ({
      tables: {
        '': {
          [TMP_TABLE_NAME]: columnMeta,
        },
      },
      keywords: sqlWhereKeywords,
      operators: sqlComparisonOperators,
      functions: [] as string[],
    }),
    [columnMeta],
  );

  const whereCompleteMeta = useMemo(
    () => ({
      ...completeMetaBase,
      prefixCode: `select * from ${TMP_TABLE_NAME} where `,
    }),
    [completeMetaBase],
  );

  const orderCompleteMeta = useMemo(
    () => ({
      ...completeMetaBase,
      prefixCode: `select * from ${TMP_TABLE_NAME} order by `,
    }),
    [completeMetaBase],
  );

  return (
    <div className="flex h-8 min-h-8 w-full flex-row items-center overflow-hidden border-b bg-background/40 font-mono">
      <div className="flex min-w-0 flex-1 flex-row items-center overflow-hidden">
        <div className="mx-2 min-w-fit text-sm text-muted-foreground">
          WHERE
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <SingleLineEditor
            className="text-sm"
            initialValue={sqlWhere}
            onChange={setSQLWhere}
            onEnterDown={handleEnterDown}
            completeMeta={whereCompleteMeta}
          />
        </div>
      </div>
      <div className="mx-2 h-5 w-px shrink-0 bg-border" />
      <div className="flex min-w-0 flex-1 flex-row items-center overflow-hidden">
        <div className="mx-2 min-w-fit text-sm text-muted-foreground">
          ORDER BY
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <SingleLineEditor
            initialValue={sqlOrderBy}
            onChange={setSQLOrderBy}
            onEnterDown={handleEnterDown}
            completeMeta={orderCompleteMeta}
          />
        </div>
      </div>
    </div>
  );
});
