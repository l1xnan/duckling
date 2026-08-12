import { useCallback, useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { nanoid } from 'nanoid';

import { useDialog } from '@/components/custom/use-dialog';
import { isQueryErrorCode } from '@/lib/capabilities';
import { filterRows } from '@/lib/filterRows';
import { runsAtom } from '@/stores/app';
import {
  mapParseLocationToDocument,
  useEditorSqlErrorStore,
} from '@/stores/editorSqlError';
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
import { TableDataPanel } from './TableDataPanel';

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

  const patch = useCallback(
    (
      partial:
        | Partial<QueryContextType>
        | ((prev: QueryContextType) => QueryContextType),
    ) => {
      patchChild(editorId, queryId, partial);
    },
    [editorId, patchChild, queryId],
  );

  const patchHistoryResult = useCallback(
    (
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
    },
    [setRuns],
  );

  const handleCancel = useCallback(async () => {
    const rid = requestIdRef.current;
    if (!rid) return;
    try {
      await cancelExecuteSQL(rid);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleQuery = useCallback(
    async (input?: QueryContextType) => {
      const requestId = nanoid();
      requestIdRef.current = requestId;
      try {
        setLoading(true);
        setError(null);
        useEditorSqlErrorStore.getState().clear(editorId);
        const current = input ?? getQueryChild(editorId, queryId);
        if (!current) {
          return;
        }
        const res = await executeSQL(current, { requestId });
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
          const loc = res.parseLocation;
          if (loc && loc.line > 0) {
            const mapped = mapParseLocationToDocument(loc, current.sourceRange);
            useEditorSqlErrorStore.getState().setError(editorId, {
              message: loc.message || res.message,
              line: mapped.line,
              column: mapped.column,
            });
          }
        } else if (res?.message) {
          setError(res.message);
        }
      } catch (err) {
        console.error(err);
        const msg = err instanceof Error ? err.message : String(err);
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
    },
    [editorId, patch, patchHistoryResult, queryId],
  );

  useEffect(() => {
    const current = getQueryChild(editorId, queryId);
    if (current) {
      void handleQuery(current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const precision = usePrecision();

  const [resultFilter, setResultFilter] = useState('');
  const [countColumn, setCountColumn] = useState<string | undefined>();
  const [pivotRowField, setPivotRowField] = useState<string | undefined>();
  const countByDialog = useDialog();
  const pivotDialog = useDialog();

  const handleRefresh = useCallback(async () => {
    await handleQuery();
  }, [handleQuery]);

  const setPagination = useCallback(
    async ({
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
    },
    [handleQuery, patch],
  );

  const handleShowValue = useCallback(() => {
    patch({ showValue: !ctx?.showValue });
  }, [ctx?.showValue, patch]);

  const handleBeautify = useCallback(() => {
    patch((prev) => ({ ...prev, beautify: !prev.beautify }));
  }, [patch]);

  const handleTranspose = useCallback(() => {
    patch((prev) => ({ ...prev, transpose: !prev.transpose }));
  }, [patch]);

  const handleCross = useCallback(() => {
    patch((prev) => ({ ...prev, cross: !prev.cross }));
  }, [patch]);

  const handleHiddenColumns = useCallback(
    (key: string, value: boolean) => {
      patch({
        hiddenColumns: { ...(ctx?.hiddenColumns ?? {}), [key]: value },
      });
    },
    [ctx?.hiddenColumns, patch],
  );

  const handleSetDirection = useCallback(() => {
    patch({
      direction:
        ctx?.direction === 'horizontal' ? 'vertical' : 'horizontal',
    });
  }, [ctx?.direction, patch]);

  const handleCountByColumn = useCallback(
    (col?: string) => {
      if (!col) return;
      setCountColumn(col.replace(/\s*[↑↓]\s*$/, '').trim());
      countByDialog.trigger();
    },
    [countByDialog],
  );

  const handlePivotColumn = useCallback(
    (col?: string) => {
      if (!col) return;
      setPivotRowField(col.replace(/\s*[↑↓]\s*$/, '').trim());
      pivotDialog.trigger();
    },
    [pivotDialog],
  );

  if (!ctx) {
    return null;
  }

  const columnNames = (ctx.tableSchema ?? []).map((c) => c.name);
  const filteredData = filterRows(
    (ctx.data ?? []) as Record<string, unknown>[],
    resultFilter,
    columnNames,
  );

  const showErrorOnly = !ctx.data?.length && error;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
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
      <TableDataPanel
        loading={loading}
        data={filteredData}
        schema={ctx.tableSchema ?? []}
        hiddenColumns={ctx.hiddenColumns}
        setHiddenColumns={handleHiddenColumns}
        precision={precision}
        beautify={ctx.beautify}
        transpose={ctx.transpose}
        cross={ctx.cross}
        showValue={ctx.showValue}
        direction={ctx.direction}
        setShowValue={handleShowValue}
        setDirection={handleSetDirection}
        onCountByColumn={handleCountByColumn}
        onPivotColumn={handlePivotColumn}
        emptyOverlay={
          showErrorOnly ? (
            <div className="select-text font-mono text-sm">{error}</div>
          ) : undefined
        }
      />
      <CountByQueryDialog
        {...countByDialog.props}
        column={countColumn}
        dbId={ctx.dbId}
        sourceSql={ctx.sql || ctx.stmt || ''}
        rowTotal={ctx.total}
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
