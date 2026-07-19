import { Suspense, useEffect, useState } from 'react';

import { CanvasTable } from '@/components/tables/CanvasTable';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Loading, SelectedCellType } from '@/components/views/TableView';
import { usePrecision } from '@/stores/setting';
import {
  executeSQL,
  getQueryChild,
  useQuerySessionStore,
  type QueryContextType,
} from '@/stores/tabs';

import { DataViewToolbar } from './DataViewToolbar';
import { ValueViewer } from './ValueViewer';

export function QueryView({
  editorId,
  queryId,
}: {
  editorId: string;
  queryId: string;
}) {
  const ctx = useQuerySessionStore(
    (s) => s.byEditor[editorId]?.byId[queryId],
  );
  const patchChild = useQuerySessionStore((s) => s.patchChild);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (
    partial:
      | Partial<QueryContextType>
      | ((prev: QueryContextType) => QueryContextType),
  ) => {
    patchChild(editorId, queryId, partial);
  };

  const handleQuery = async (input?: QueryContextType) => {
    try {
      setLoading(true);
      const current = input ?? getQueryChild(editorId, queryId);
      if (!current) {
        return;
      }
      const res = await executeSQL(current);
      patch((prev) => ({ ...prev, ...res }));
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

  useEffect(() => {
    const current = getQueryChild(editorId, queryId);
    if (current) {
      void handleQuery(current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const precision = usePrecision();

  const [selectedCell, setSelectCell] = useState<SelectedCellType | null>(null);
  const [selectedCellInfos, setSelectedCellInfos] = useState<
    SelectedCellType[][] | null
  >();

  const handleRefresh = async () => {
    await handleQuery();
  };

  const setPagination = async ({
    page,
    perPage,
  }: {
    page?: number;
    perPage?: number;
  }) => {
    if (page !== undefined || perPage !== undefined) {
      patch({
        ...(page !== undefined ? { page } : {}),
        ...(perPage !== undefined ? { perPage } : {}),
      });
    }
    await handleQuery();
  };

  if (!ctx) {
    return null;
  }

  const handleShowValue = () => {
    patch({ showValue: !ctx.showValue });
  };

  const handleBeautify = () => {
    patch((prev) => ({ ...prev, beautify: !prev.beautify }));
  };

  const handleTranspose = () => {
    patch((prev) => ({ ...prev, transpose: !prev.transpose }));
  };

  const handleCross = () => {
    patch((prev) => ({ ...prev, cross: !prev.cross }));
  };

  const handleHiddenColumns = (key: string, value: boolean) => {
    patch({
      hiddenColumns: { ...ctx.hiddenColumns, [key]: value },
    });
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
        columns={ctx.tableSchema}
        hiddenColumns={ctx.hiddenColumns}
        setHiddenColumns={handleHiddenColumns}
        setShowValue={handleShowValue}
        refresh={handleRefresh}
        setBeautify={handleBeautify}
        setPagination={setPagination}
        setTranspose={handleTranspose}
        setCross={handleCross}
      />
      <ResizablePanelGroup orientation={ctx.direction}>
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
              hiddenColumns={ctx.hiddenColumns}
              setHiddenColumns={handleHiddenColumns}
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
                  patch({
                    direction:
                      ctx.direction == 'horizontal'
                        ? 'vertical'
                        : 'horizontal',
                  });
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
