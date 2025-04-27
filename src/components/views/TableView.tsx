import { useAtomValue } from 'jotai';
import { Loader2Icon } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { CanvasTable } from '@/components/tables';
import { cn } from '@/lib/utils';
import { precisionAtom } from '@/stores/setting';
import { TabContextType, useTabsStore } from '@/stores/tabs';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { usePageStore } from '@/hooks/context';
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
  value?: string | number;
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
  }, []);
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
    setBeautify,
    setPagination,
    setTranspose,
    setCross,
  } = usePageStore();

  return (
    <div className="h-full flex flex-col">
      <DataViewToolbar
        length={data.length}
        page={page}
        perPage={perPage}
        total={total}
        sql={sql}
        elapsed={elapsed}
        cross={cross}
        transpose={transpose}
        setShowValue={setShowValue}
        refresh={refresh}
        setBeautify={setBeautify}
        setPagination={setPagination}
        setTranspose={setTranspose}
        setCross={setCross}
      />
      <ResizablePanelGroup direction={direction}>
        <ResizablePanel defaultSize={80} className="flex flex-col size-full">
          <div className="h-full flex flex-col">
            <InputToolbar />
            <div className="h-full flex-1 overflow-hidden">
              <Suspense fallback={<Loading />}>
                {loading ? <Loading /> : null}
                <CanvasTable
                  style={loading ? { display: 'none' } : undefined}
                  data={data ?? []}
                  schema={tableSchema ?? []}
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
        <ResizableHandle />
        {showValue ? (
          <ResizablePanel
            defaultSize={20}
            className="flex flex-row items-start"
          >
            <div className="flex size-full">
              <ValueViewer
                selectedCell={selectedCell}
                selectedCellInfos={selectedCellInfos}
                setShowValue={setShowValue}
                setDirection={setDirection}
                direction={direction}
              />
            </div>
          </ResizablePanel>
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
}

export function InputToolbar() {
  const { setSQLWhere, setSQLOrderBy } = usePageStore();

  const [stmt, setStmt] = useState({
    where: '',
    orderBy: '',
  });

  return (
    <div className="flex flex-row items-center h-8 min-h-8 bg-background/40 border-b font-mono">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={50} className="flex flex-row items-center">
          <div className="mx-1.5 text-muted-foreground text-sm">WHERE</div>
          <input
            className="flex-1 h-full border-none p-0 outline-none bg-transparent text-sm"
            value={stmt.where}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                setSQLOrderBy(stmt.orderBy);
                setSQLWhere(stmt.where);
              }
            }}
            onChange={(e) => {
              setStmt((v) => ({ ...v, where: e.target.value }));
            }}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={50} className="flex flex-row items-center">
          <div className="mx-1.5 text-muted-foreground text-sm">ORDER BY</div>
          <input
            className="flex-1 h-full border-none p-0 outline-none bg-transparent text-sm"
            value={stmt.orderBy}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                setSQLOrderBy(stmt.orderBy);
                setSQLWhere(stmt.where);
              }
            }}
            onChange={(e) => {
              setStmt((v) => ({ ...v, orderBy: e.target.value }));
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
