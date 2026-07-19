import { Data as ArrowDataType } from '@apache-arrow/ts';
import { toMerged } from 'es-toolkit/object';
import { Loader2Icon } from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';
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
import { cn } from '@/lib/utils';
import { SchemaType } from '@/stores/dataset';
import { useConnectionMeta } from '@/stores/dbList';
import { usePrecision } from '@/stores/setting';
import { TabContextType, TableContextType, useTabsStore } from '@/stores/tabs';

import { CountByColumnDialog } from './CountByColumnDialog';
import { DataViewToolbar } from './DataViewToolbar';
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
  } = usePageStore();

  const countByDialog = useDialog();

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
        length={data.length}
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
        setShowValue={setShowValue}
        refresh={refresh}
        setBeautify={setBeautify}
        setPagination={setPagination}
        setTranspose={setTranspose}
        setCross={setCross}
        loading={loading}
        onCancel={handleCancel}
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
                  data={data ?? []}
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
                  onOrderByColumn={(col, options) => {
                    if (!col || !setOrderBy) return;
                    const name = col.replace(/\s*[↑↓]\s*$/, '').trim();
                    setOrderBy(name, options);
                  }}
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
