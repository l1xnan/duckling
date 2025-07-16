import { PrimitiveAtom, useAtom, useAtomValue } from 'jotai';
import { Suspense, useEffect, useState } from 'react';

import { CanvasTable } from '@/components/tables/CanvasTable';
import { Loading, SelectedCellType } from '@/components/views/TableView';
import { atomStore } from '@/stores';
import { precisionAtom } from '@/stores/setting';
import { QueryContextType, executeSQL, exportData } from '@/stores/tabs';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useFocusAtom } from '@/hooks';
import { DataViewToolbar } from './DataViewToolbar';
import { ValueViewer } from './ValueViewer';

type QueryContextAtom = PrimitiveAtom<QueryContextType>;

export function QueryView({ context }: { context: QueryContextAtom }) {
  const [ctx, setContext] = useAtom(context);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = async (ctx?: QueryContextType) => {
    try {
      setLoading(true);
      if (!ctx) {
        ctx = atomStore.get(context);
      }
      const res = await executeSQL(ctx);
      setContext((prev) => ({ ...prev, ...res }));
      if (res?.message) {
        setError(res?.message);
      }
    } catch (error) {
      console.error(error);
      setError(error as string);
    } finally {
      setLoading(false);
    }
  };
  const handleExport = async (file: string) => {
    try {
      const ctx = atomStore.get(context);
      await exportData({ file }, ctx);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    (async () => {
      await handleQuery(ctx);
    })();
  }, []);

  const precision = useAtomValue(precisionAtom);

  const [selectedCell, setSelectCell] = useState<SelectedCellType | null>(null);
  const [selectedCellInfos, setSelectedCellInfos] = useState<
    SelectedCellType[][] | null
  >();
  const setShowValue = useFocusAtom(context, 'showValue');
  const setDirection = useFocusAtom(context, 'direction');
  const handleRefresh = async () => {
    await handleQuery(ctx);
  };

  const setBeautify = useFocusAtom(context, 'beautify');
  const setPage = useFocusAtom(context, 'page');
  const setPerPage = useFocusAtom(context, 'perPage');
  const setTranspose = useFocusAtom(context, 'transpose');
  const setCross = useFocusAtom(context, 'cross');
  const setPagination = async ({
    page,
    perPage,
  }: {
    page?: number;
    perPage?: number;
  }) => {
    setPage(page as number);
    setPerPage(perPage as number);
    await handleRefresh();
  };

  const handleShowValue = () => {
    setShowValue(!ctx.showValue);
  };

  const handleBeautify = () => {
    setBeautify((prev) => !prev);
  };

  const handleTranspose = () => {
    setTranspose((v) => !v);
  };
  const handleCross = () => {
    setCross((v) => !v);
  };

  return (
    <div className="h-full flex flex-col">
      <DataViewToolbar
        dbId={ctx.dbId}
        length={ctx.data?.length ?? 0}
        page={ctx.page}
        perPage={ctx.perPage}
        total={ctx.total}
        sql={ctx.sql}
        elapsed={ctx.elapsed}
        cross={ctx.cross}
        transpose={ctx.transpose}
        setShowValue={handleShowValue}
        refresh={handleRefresh}
        setBeautify={handleBeautify}
        setPagination={setPagination}
        setTranspose={handleTranspose}
        setCross={handleCross}
      />
      <ResizablePanelGroup direction={ctx.direction}>
        <ResizablePanel defaultSize={80}>
          <Suspense fallback={<Loading />}>
            {loading ? <Loading /> : null}
            {!ctx.data?.length && error ? (
              <div className="font-mono text-sm select-text">{error}</div>
            ) : null}
            <CanvasTable
              style={
                loading || (!ctx.data?.length && error)
                  ? { display: 'none' }
                  : undefined
              }
              data={ctx.data ?? []}
              schema={ctx.tableSchema ?? []}
              precision={precision}
              beautify={ctx.beautify}
              transpose={ctx.transpose}
              cross={ctx.cross}
              onSelectedCell={(arg) => {
                setSelectCell(arg);
              }}
              onSelectedCellInfos={(cells) => {
                setSelectedCellInfos(cells);
              }}
            />
          </Suspense>
        </ResizablePanel>
        <ResizableHandle />
        {ctx.showValue ? (
          <ResizablePanel
            defaultSize={20}
            className="flex flex-row items-start"
          >
            <div className="flex size-full">
              <ValueViewer
                selectedCell={selectedCell}
                selectedCellInfos={selectedCellInfos}
                setShowValue={handleShowValue}
                setDirection={() => {
                  setDirection(
                    ctx.direction == 'horizontal' ? 'vertical' : 'horizontal',
                  );
                }}
                direction={ctx.direction}
              />
            </div>
          </ResizablePanel>
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
}
