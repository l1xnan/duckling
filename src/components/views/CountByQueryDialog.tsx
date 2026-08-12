import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { nanoid } from 'nanoid';
import { useEffect, useRef, useState } from 'react';

import { cancelQuery, query } from '@/api';
import { SimpleBarChart } from '@/components/charts/SimpleBarChart';
import Dialog from '@/components/custom/Dialog';
import { SimpleTable } from '@/components/tables';
import { Button } from '@/components/custom/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/custom/ui/tabs';
import { Loading } from '@/components/views/TableView';
import { isQueryErrorCode } from '@/lib/capabilities';
import { connectionRef } from '@/lib/connectionRef';
import {
  mapCountByRows,
  parseScalarCountResult,
  resolveAllRowsTotal,
  toCountByDisplayRows,
} from '@/lib/sql/countByColumn';
import {
  buildCountBySubquerySql,
  buildSubqueryRowCountSql,
} from '@/lib/sql/countBySubquery';
import { getDatabase } from '@/stores/tabs';

export type CountByQueryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column?: string;
  dbId: string;
  /** Original result SQL (preferred) or editor statement. */
  sourceSql: string;
  /** All matching rows in the parent query result (denominator for percent). */
  rowTotal?: number;
};

type CountRow = {
  value: unknown;
  count: number;
};

export function CountByQueryDialog({
  open,
  onOpenChange,
  column,
  dbId,
  sourceSql,
  rowTotal,
}: CountByQueryDialogProps) {
  const { t } = useLingui();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CountRow[]>([]);
  const [allRowsTotal, setAllRowsTotal] = useState(0);
  const [sql, setSql] = useState<string>('');
  const [elapsed, setElapsed] = useState<number | undefined>();
  const requestIdRef = useRef<string | null>(null);

  const handleCancel = async () => {
    const rid = requestIdRef.current;
    if (!rid) return;
    try {
      await cancelQuery(rid);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!open || !column || !sourceSql.trim()) {
      return;
    }

    let cancelled = false;
    const requestId = nanoid();
    requestIdRef.current = requestId;

    (async () => {
      setLoading(true);
      setError(null);
      setRows([]);
      setAllRowsTotal(0);
      setSql('');
      setElapsed(undefined);

      try {
        const db = getDatabase(dbId);
        if (!db) {
          throw new Error(t`Connection not found`);
        }
        const dialectName = db.dialect ?? 'generic';
        const countSql = buildCountBySubquerySql({
          sourceSql,
          column,
          dialect: dialectName,
          limit: 1000,
        });
        setSql(countSql);

        const res = await query({
          sql: countSql,
          dialect: connectionRef(dbId),
          limit: 0,
          offset: 0,
          requestId,
        });

        if (cancelled) return;

        if (isQueryErrorCode(res.code)) {
          setError(res.message || t`Query failed`);
          setElapsed(res.elapsed);
          return;
        }

        const data = mapCountByRows(res.data ?? []);
        const total = await resolveAllRowsTotal(data, rowTotal, async () => {
          const totalSql = buildSubqueryRowCountSql(sourceSql);
          const totalRes = await query({
            sql: totalSql,
            dialect: connectionRef(dbId),
            limit: 0,
            offset: 0,
            requestId: `${requestId}-total`,
          });
          if (isQueryErrorCode(totalRes.code)) {
            throw new Error(totalRes.message || t`Query failed`);
          }
          return parseScalarCountResult(totalRes.data ?? []);
        });

        if (cancelled) return;

        setRows(data);
        setAllRowsTotal(total);
        setElapsed(res.elapsed);
      } catch (e) {
        if (!cancelled) {
          const msgText = e instanceof Error ? e.message : String(e);
          if (msgText.toLowerCase().includes('cancel')) {
            setError(t`Query cancelled`);
          } else {
            setError(msgText);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
        if (requestIdRef.current === requestId) {
          requestIdRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      const rid = requestIdRef.current;
      if (rid === requestId) {
        void cancelQuery(rid).catch(() => {});
        requestIdRef.current = null;
      }
    };
  }, [open, column, dbId, sourceSql, rowTotal, t]);

  const displayRows = toCountByDisplayRows(rows, allRowsTotal);
  const capped = displayRows.length >= 1000;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        column ? (
          <Trans>
            Count by column: <code className="text-sm">{column}</code>
          </Trans>
        ) : (
          <Trans>Count by column</Trans>
        )
      }
      className="min-w-[min(720px,90vw)] h-[min(560px,90vh)]"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-2">
        {sql ? (
          <div className="shrink-0 rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all select-text">
            {sql}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
            <Loading className="h-40" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void handleCancel();
              }}
            >
              <Trans>Stop</Trans>
            </Button>
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive select-text">
            {error}
          </div>
        ) : (
          <>
            <div className="flex shrink-0 flex-col gap-1 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>
                  {capped ? (
                    <Trans>
                      {displayRows.length} distinct value(s) (capped at 1000)
                    </Trans>
                  ) : (
                    <Trans>{displayRows.length} distinct value(s)</Trans>
                  )}
                </span>
                {elapsed != null ? (
                  <span>
                    <Trans>elapsed: {elapsed}ms</Trans>
                  </span>
                ) : null}
              </div>
              {capped ? (
                <span>
                  <Trans>
                    Percent is relative to all matching rows ({allRowsTotal});
                    shown groups may sum to less than 100%.
                  </Trans>
                </span>
              ) : null}
            </div>
            <Tabs defaultValue="table" className="min-h-0 flex-1 flex flex-col">
              <TabsList variant="line" className="shrink-0">
                <TabsTrigger value="table">
                  <Trans>Table</Trans>
                </TabsTrigger>
                <TabsTrigger value="chart">
                  <Trans>Chart</Trans>
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="table"
                className="min-h-0 flex-1 overflow-hidden rounded-md border mt-2"
              >
                {displayRows.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    <Trans>No rows</Trans>
                  </div>
                ) : (
                  <SimpleTable data={displayRows} />
                )}
              </TabsContent>
              <TabsContent
                value="chart"
                className="min-h-0 flex-1 overflow-auto rounded-md border mt-2 p-2"
              >
                <SimpleBarChart
                  data={displayRows.slice(0, 30).map((r) => ({
                    label: r.value,
                    value: r.count,
                  }))}
                  height={360}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Dialog>
  );
}

void msg`Count by this column`;
