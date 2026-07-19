import { Data as ArrowDataType } from '@apache-arrow/ts';
import { toMerged } from 'es-toolkit/object';
import { Loader2Icon } from 'lucide-react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useDialog } from '@/components/custom/use-dialog';
import { SingleLineEditor } from '@/components/editor/SingleLineEditor';
import {
  sqlComparisonOperators,
  sqlWhereKeywords,
} from '@/components/editor/useRegister';
import { CanvasTable } from '@/components/tables';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { usePageStore } from '@/hooks/context';
import { buildQuickFilterWhere, filterRows } from '@/lib/filterRows';
import { quoteIdent } from '@/lib/sql/countByColumn';
import { buildCellPredicate, mergeWhere } from '@/lib/sql/drillDown';
import { cn } from '@/lib/utils';
import { SchemaType } from '@/stores/dataset';
import { getStoredDB, useConnectionMeta } from '@/stores/dbList';
import { usePrecision } from '@/stores/setting';
import { TabContextType, TableContextType, useTabsStore } from '@/stores/tabs';

import { ColumnProfileDialog } from './ColumnProfileDialog';
import { CountByColumnDialog } from './CountByColumnDialog';
import { DataViewToolbar } from './DataViewToolbar';
import { PivotDialog } from './PivotDialog';
import { ValueViewer } from './ValueViewer';

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
  const {
    refresh,
    cancelRefresh,
    loading,
    data,
    tableSchema,
    beautify,
    orderBy,
    setOrderBy,
    transpose,
    cross,
    showValue,
    direction,
  } = usePageStore();
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

  const [selectedCell, setSelectCell] = useState<SelectedCellType | null>();
  const [selectedCellInfos, setSelectedCellInfos] = useState<
    SelectedCellType[][] | null
  >();
  const { setShowValue, setDirection } = usePageStore();

  const {
    page,
    perPage,
    total,
    sql,
    elapsed,
    sqlWhere,
    hiddenColumns,
    dialogColumn,
    setBeautify,
    setPagination,
    setTranspose,
    setHiddenColumns,
    setCross,
    setDialogColumn,
    setSQLWhere,
  } = usePageStore();

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

  const resolveDialect = () =>
    getStoredDB(context.dbId)?.dialect ??
    ((context as TableContextType).type === 'file' ? 'file' : 'generic');

  const handleApplyFilterToWhere = () => {
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
  };

  const handleDrillDown = (column: string, value: unknown) => {
    const predicate = buildCellPredicate(column, value, resolveDialect());
    setSQLWhere(mergeWhere(sqlWhere, predicate));
    void refresh();
  };

  const handleCancel = async () => {
    try {
      await cancelRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <DataViewToolbar
        context={context as TableContextType}
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
      <ResizablePanelGroup orientation={direction}>
        <ResizablePanel defaultSize={80} className="size-full">
          <div className="h-full flex flex-col">
            <InputToolbar
              context={context as TableContextType}
              schema={tableSchema ?? []}
            />
            <div className="h-full flex-1 overflow-hidden mb-px">
              <Suspense fallback={<Loading />}>
                {loading ? <Loading /> : null}
                <CanvasTable
                  style={loading ? { display: 'none' } : undefined}
                  data={filteredData}
                  schema={tableSchema ?? []}
                  hiddenColumns={hiddenColumns}
                  setHiddenColumns={setHiddenColumns}
                  beautify={beautify}
                  orderBy={orderBy}
                  precision={precision}
                  transpose={transpose}
                  cross={cross}
                  onSelectedCell={(arg: SelectedCellType | null) => {
                    setSelectCell(arg);
                  }}
                  onSelectedCellInfos={(cells) => {
                    setSelectedCellInfos(cells);
                  }}
                  onCountByColumn={(col) => {
                    if (!col) return;
                    setDialogColumn(col);
                    countByDialog.trigger();
                  }}
                  onProfileColumn={(col) => {
                    if (!col) return;
                    setProfileColumn(col.replace(/\s*[↑↓]\s*$/, '').trim());
                    profileDialog.trigger();
                  }}
                  onPivotColumn={(col) => {
                    if (!col) return;
                    setPivotRowField(col.replace(/\s*[↑↓]\s*$/, '').trim());
                    pivotDialog.trigger();
                  }}
                  onOrderByColumn={(col, options) => {
                    if (!col || !setOrderBy) return;
                    const name = col.replace(/\s*[↑↓]\s*$/, '').trim();
                    setOrderBy(name, options);
                  }}
                  onDrillDown={handleDrillDown}
                />
              </Suspense>
            </div>
          </div>
        </ResizablePanel>
        {showValue ? (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={20}>
              <div className="size-full">
                <ValueViewer
                  selectedCell={selectedCell}
                  selectedCellInfos={selectedCellInfos}
                  setShowValue={setShowValue}
                  setDirection={setDirection}
                  direction={direction}
                />
              </div>
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
      <CountByColumnDialog
        {...countByDialog.props}
        column={dialogColumn}
        context={context as TableContextType}
        sqlWhere={sqlWhere}
      />
      <ColumnProfileDialog
        {...profileDialog.props}
        column={profileColumn}
        context={context as TableContextType}
        sqlWhere={sqlWhere}
      />
      <PivotDialog
        {...pivotDialog.props}
        columns={tableSchema ?? []}
        context={context as TableContextType}
        sqlWhere={sqlWhere}
        initialRowField={pivotRowField}
      />
    </div>
  );
}

export function InputToolbar({
  context,
  schema,
}: {
  context: TableContextType;
  schema: SchemaType[];
}) {
  const { setSQLWhere, setSQLOrderBy, refresh, sqlWhere, sqlOrderBy } =
    usePageStore();

  const { dbId, tableId } = context;
  const tableSchema = useConnectionMeta(dbId);

  const handleEnterDown = async (_value: string) => {
    await refresh();
  };

  const tmpTableName = '__tmp__';
  const current = {
    '': {
      [tmpTableName]: schema.map(({ name, type }) => ({ name, type })),
    },
  };

  console.log('tableId:', tableId);

  const completeMeta = {
    tables: toMerged(tableSchema ?? {}, current),
    keywords: sqlWhereKeywords,
    operators: sqlComparisonOperators,
    functions: [],
  };

  return (
    <div className="flex flex-row items-center h-8 min-h-8 w-full overflow-hidden bg-background/40 border-b font-mono">
      <ResizablePanelGroup orientation="horizontal" className="min-w-0">
        <ResizablePanel defaultSize={50} className="flex flex-row items-center min-w-0 overflow-hidden">
          <div className="mx-2 min-w-fit text-muted-foreground text-sm">
            WHERE
          </div>
          <div className="w-full min-w-0 overflow-hidden">
            <SingleLineEditor
              className="text-sm"
              initialValue={sqlWhere}
              onChange={setSQLWhere}
              onEnterDown={handleEnterDown}
              completeMeta={{
                ...completeMeta,
                prefixCode: `select * from ${tmpTableName} where `,
              }}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={50} className="flex flex-row items-center min-w-0 overflow-hidden">
          <div className="mx-2 min-w-fit text-muted-foreground text-sm">
            ORDER BY
          </div>
          <div className="w-full min-w-0 overflow-hidden">
            <SingleLineEditor
              initialValue={sqlOrderBy}
              onChange={setSQLOrderBy}
              onEnterDown={handleEnterDown}
              completeMeta={{
                ...completeMeta,
                prefixCode: `select * from ${tmpTableName} order by `,
              }}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
