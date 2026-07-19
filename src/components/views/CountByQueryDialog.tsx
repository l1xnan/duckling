import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { nanoid } from 'nanoid';
import { useEffect, useRef, useState } from 'react';

import { cancelQuery, query } from '@/api';
import Dialog from '@/components/custom/Dialog';
import { SimpleTable } from '@/components/tables';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/views/TableView';
import { isQueryErrorCode } from '@/lib/capabilities';
import { connectionRef } from '@/lib/connectionRef';
import { buildCountBySubquerySql } from '@/lib/sql/countBySubquery';
import { getDatabase } from '@/stores/tabs';

export type CountByQueryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column?: string;
  dbId: string;
  /** Original result SQL (preferred) or editor statement. */
  sourceSql: string;
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
}: CountByQueryDialogProps) {
  const { t } = useLingui();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CountRow[]>([]);
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

        const data = (res.data ?? []).map((row) => {
          const r = row as Record<string, unknown>;
          const value = r.value ?? r.VALUE ?? r.Value ?? Object.values(r)[0];
          const countRaw =
            r.count ?? r.COUNT ?? r.Count ?? Object.values(r)[1] ?? 0;
          const count =
            typeof countRaw === 'bigint'
              ? Number(countRaw)
              : Number(countRaw) || 0;
          return { value, count };
        });

        setRows(data);
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
  }, [open, column, dbId, sourceSql, t]);

  const displayRows = rows.map((r) => ({
    value: r.value == null || r.value === '' ? '<null>' : String(r.value),
    count: r.count,
  }));

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
            <div className="flex shrink-0 items-center justify-between text-xs text-muted-foreground">
              <span>
                <Trans>
                  {displayRows.length} distinct value(s)
                  {displayRows.length >= 1000
                    ? ' (capped at 1000)'
                    : null}
                </Trans>
              </span>
              {elapsed != null ? (
                <span>
                  <Trans>elapsed: {elapsed}ms</Trans>
                </span>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
              {displayRows.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  <Trans>No rows</Trans>
                </div>
              ) : (
                <SimpleTable data={displayRows} />
              )}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

void msg`Count by this column`;
