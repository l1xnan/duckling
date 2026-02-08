import { Data as ArrowDataType } from '@apache-arrow/ts';
import { useAtomValue } from 'jotai';
import { Loader2Icon } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';

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
import { schemaMapAtom } from '@/stores/dbList';
import { precisionAtom } from '@/stores/setting';
import { TabContextType, TableContextType, useTabsStore } from '@/stores/tabs';

import { DataViewToolbar } from './DataViewToolbar';
import { ValueViewer } from './ValueViewer';

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

export type SelectedCellType = {
  value?: string | number | ArrowDataType;
  field?: string;
  col: number;
  row: number;
};

export function TableView({ context }: { context: TabContextType }) {
  const {
    refresh,
    loading,
    data,
    tableSchema,
    beautify,
    orderBy,
    transpose,
    cross,
    showValue,
    direction,
  } = usePageStore();
  const currentTab = useTabsStore((s) => s.currentId);

  useEffect(() => {
    if (currentTab == context.id) {
      (async () => {
        try {
          await refresh();
        } catch (error) {
          toast.error((error as Error).message);
        }
      })();
    }
  }, [context.id, currentTab, refresh]);
  const precision = useAtomValue(precisionAtom);

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
    hiddenColumns,
    setBeautify,
    setPagination,
    setTranspose,
    setHiddenColumns,
    setCross,
  } = usePageStore();

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
      />
      <ResizablePanelGroup orientation={direction}>
        <ResizablePanel defaultSize={80} className="size-full">
          <div className="h-full flex flex-col">
            <InputToolbar context={context as TableContextType} />
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
    </div>
  );
}

export function InputToolbar({ context }: { context: TableContextType }) {
  const { setSQLWhere, setSQLOrderBy, refresh, sqlWhere, sqlOrderBy } =
    usePageStore();

  const schemaMap = useAtomValue(schemaMapAtom);
  const { dbId, tableId } = context;
  const tableSchema = schemaMap.get(dbId);

  const handleEnterDown = async (_value: string) => {
    await refresh();
  };

  const completeMeta = {
    tables: tableSchema,
    keywords: sqlWhereKeywords,
    operators: sqlComparisonOperators,
    functions: [],
  };

  return (
    <div className="flex flex-row items-center h-8 min-h-8 bg-background/40 border-b font-mono">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={50} className="flex flex-row items-center">
          <div className="mx-2 min-w-fit text-muted-foreground text-sm">
            WHERE
          </div>
          <div className="w-full">
            <SingleLineEditor
              className="text-sm"
              initialValue={sqlWhere}
              onChange={setSQLWhere}
              onEnterDown={handleEnterDown}
              completeMeta={{
                ...completeMeta,
                prefixCode: `select * from ${tableId} where `,
              }}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={50} className="flex flex-row items-center">
          <div className="mx-2 min-w-fit text-muted-foreground text-sm">
            ORDER BY
          </div>
          <div className="w-full">
            <SingleLineEditor
              initialValue={sqlOrderBy}
              onChange={setSQLOrderBy}
              onEnterDown={handleEnterDown}
              completeMeta={{
                ...completeMeta,
                prefixCode: `select * from ${tableId} order by `,
              }}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
