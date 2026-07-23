import { Suspense, useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { nanoid } from 'nanoid';

import { useDialog } from '@/components/custom/use-dialog';
import { CanvasTable } from '@/components/tables/CanvasTable';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Loading, SelectedCellType } from '@/components/views/TableView';
import { isQueryErrorCode } from '@/lib/capabilities';
import { filterRows } from '@/lib/filterRows';
import { runsAtom } from '@/stores/app';
import { usePrecision } from '@/stores/setting';
import {
  cancelExecuteSQL,
  executeSQL,
  getQueryChild,
  useQuerySessionStore,
  type QueryContextType,
} from '@/stores/tabs';

import { CountByQueryDialog } from './CountByQueryDialog';
import { DataViewToolbar } from './DataViewToolbar';
import { PivotDialog } from './PivotDialog';
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
  const setRuns = useSetAtom(runsAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const patch = (
    partial:
      | Partial<QueryContextType>
      | ((prev: QueryContextType) => QueryContextType),
  ) => {
    patchChild(editorId, queryId, partial);
  };

  const patchHistoryResult = (
    queryIdKey: string,
    result: {
      elapsed?: number;
      total?: number;
      code?: number;
      message?: string;
      sql?: string;
    },
  ) => {
    setRuns((prev) =>
      (prev ?? []).map((item) =>
        item.id === queryIdKey
          ? {
              ...item,
              elapsed: result.elapsed ?? item.elapsed,
              total: result.total ?? item.total,
              code: result.code ?? item.code,
              message: result.message ?? item.message,
              sql: result.sql ?? item.sql,
            }
          : item,
      ),
    );
  };

  const handleCancel = async () => {
    const rid = requestIdRef.current;
    if (!rid) return;
    try {
      await cancelExecuteSQL(rid);
    } catch (e) {
      console.error(e);
    }
  };

  const handleQuery = async (input?: QueryContextType) => {
    const requestId = nanoid();
    requestIdRef.current = requestId;
    try {
      setLoading(true);
      setError(null);
      const current = input ?? getQueryChild(editorId, queryId);
      if (!current) {
        return;
      }
      const res = await executeSQL(current, { requestId });
      // Preserve stmt-backed sql when the backend omits it on failure.
      const failedSql = res?.sql || current.stmt || current.sql;
      patch((prev) => ({
        ...prev,
        ...res,
        sql: res?.sql || prev.sql || current.stmt,
      }));
      patchHistoryResult(current.id ?? queryId, {
        elapsed: res?.elapsed,
        total: res?.total,
        code: res?.code,
        message: res?.message,
        sql: failedSql,
      });
      if (isQueryErrorCode(res?.code) && res?.message) {
        setError(res.message);
      } else if (res?.message) {
        setError(res.message);
      }
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : String(error);
      setError(msg);
      const current = getQueryChild(editorId, queryId);
      patch({ sql: current?.stmt || current?.sql });
      patchHistoryResult(queryId, {
        message: msg,
        code: -1,
        sql: current?.stmt || current?.sql,
      });
    } finally {
      if (requestIdRef.current === requestId) {
        requestIdRef.current = null;
      }
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
  const [resultFilter, setResultFilter] = useState('');
  const [countColumn, setCountColumn] = useState<string | undefined>();
  const [pivotRowField, setPivotRowField] = useState<string | undefined>();
  const countByDialog = useDialog();
  const pivotDialog = useDialog();

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

  const columnNames = (ctx.tableSchema ?? []).map((c) => c.name);
  const filteredData = filterRows(
    (ctx.data ?? []) as Record<string, unknown>[],
    resultFilter,
    columnNames,
  );

  return (
    <div className="h-full min-h-0 min-w-0 flex flex-col overflow-hidden">
      <DataViewToolbar
        dbId={ctx.dbId}
        length={filteredData.length}
        page={ctx.page}
        perPage={ctx.perPage}
        total={ctx.total}
        sql={ctx.sql || ctx.stmt}
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
        loading={loading}
        onCancel={handleCancel}
        resultFilter={resultFilter}
        onResultFilterChange={setResultFilter}
        onPivot={() => {
          setPivotRowField(undefined);
          pivotDialog.trigger();
        }}
      />
      <ResizablePanelGroup
        orientation={ctx.direction}
        className="min-h-0 min-w-0 flex-1"
      >
        <ResizablePanel
          defaultSize={80}
          className="min-h-0 min-w-0 overflow-hidden"
        >
          <div className="h-full min-h-0 min-w-0 overflow-hidden">
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
                data={filteredData}
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
                onCountByColumn={(col) => {
                  if (!col) return;
                  setCountColumn(col.replace(/\s*[↑↓]\s*$/, '').trim());
                  countByDialog.trigger();
                }}
                onPivotColumn={(col) => {
                  if (!col) return;
                  setPivotRowField(col.replace(/\s*[↑↓]\s*$/, '').trim());
                  pivotDialog.trigger();
                }}
              />
            </Suspense>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        {ctx.showValue ? (
          <ResizablePanel
            defaultSize={20}
            className="flex min-h-0 min-w-0 flex-row items-start overflow-hidden"
          >
            <div className="flex size-full min-h-0 min-w-0 overflow-hidden">
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
      <CountByQueryDialog
        {...countByDialog.props}
        column={countColumn}
        dbId={ctx.dbId}
        sourceSql={ctx.sql || ctx.stmt || ''}
      />
      <PivotDialog
        {...pivotDialog.props}
        columns={ctx.tableSchema ?? []}
        dbId={ctx.dbId}
        sourceSql={ctx.sql || ctx.stmt || ''}
        initialRowField={pivotRowField}
      />
    </div>
  );
}
