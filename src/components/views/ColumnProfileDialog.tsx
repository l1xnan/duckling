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
import {
  buildColumnProfileSql,
  buildColumnTopNSql,
} from '@/lib/sql/columnProfile';
import {
  getDatabase,
  getParams,
  type TableContextType,
} from '@/stores/tabs';

export type ColumnProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column?: string;
  context: TableContextType;
  sqlWhere?: string;
};

type ProfileStats = {
  total: number;
  nullCount: number;
  distinctCount: number;
  minValue: unknown;
  maxValue: unknown;
};

type TopRow = { value: unknown; count: number };

function pickField(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in row) return row[k];
  }
  return undefined;
}

function toNumber(v: unknown): number {
  if (typeof v === 'bigint') return Number(v);
  return Number(v) || 0;
}

export function ColumnProfileDialog({
  open,
  onOpenChange,
  column,
  context,
  sqlWhere,
}: ColumnProfileDialogProps) {
  const { t } = useLingui();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [topRows, setTopRows] = useState<TopRow[]>([]);
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
    if (!open || !column) return;

    let cancelled = false;
    const requestId = nanoid();
    requestIdRef.current = requestId;

    (async () => {
      setLoading(true);
      setError(null);
      setStats(null);
      setTopRows([]);
      setSql('');
      setElapsed(undefined);

      try {
        const param = await getParams({
          type: context.type,
          dbId: context.dbId,
          tableId: context.tableId,
          tableName: context.tableName,
          page: 1,
          perPage: 500,
          sqlWhere,
        });

        if (!param || !('table' in param) || !param.table) {
          throw new Error(t`Could not resolve table for this view`);
        }

        const dialectName =
          getDatabase(context.dbId)?.dialect ??
          (context.type === 'file' ? 'file' : 'generic');

        const profileSql = buildColumnProfileSql({
          tableExpr: param.table,
          column,
          dialect: dialectName,
          where: sqlWhere,
        });
        const topSql = buildColumnTopNSql({
          tableExpr: param.table,
          column,
          dialect: dialectName,
          where: sqlWhere,
          topN: 10,
        });
        setSql(`${profileSql};\n${topSql}`);

        const [profileRes, topRes] = await Promise.all([
          query({
            sql: profileSql,
            dialect: param.dialect,
            limit: 0,
            offset: 0,
            requestId: `${requestId}-p`,
          }),
          query({
            sql: topSql,
            dialect: param.dialect,
            limit: 0,
            offset: 0,
            requestId: `${requestId}-t`,
          }),
        ]);

        if (cancelled) return;

        if (isQueryErrorCode(profileRes.code)) {
          setError(profileRes.message || t`Query failed`);
          setElapsed(profileRes.elapsed);
          return;
        }
        if (isQueryErrorCode(topRes.code)) {
          setError(topRes.message || t`Query failed`);
          setElapsed(topRes.elapsed);
          return;
        }

        const row = (profileRes.data?.[0] ?? {}) as Record<string, unknown>;
        setStats({
          total: toNumber(
            pickField(row, ['total', 'TOTAL', 'Total']),
          ),
          nullCount: toNumber(
            pickField(row, ['null_count', 'NULL_COUNT', 'Null_count']),
          ),
          distinctCount: toNumber(
            pickField(row, [
              'distinct_count',
              'DISTINCT_COUNT',
              'Distinct_count',
            ]),
          ),
          minValue: pickField(row, ['min_value', 'MIN_VALUE', 'Min_value']),
          maxValue: pickField(row, ['max_value', 'MAX_VALUE', 'Max_value']),
        });

        setTopRows(
          (topRes.data ?? []).map((r) => {
            const rec = r as Record<string, unknown>;
            const value =
              pickField(rec, ['value', 'VALUE', 'Value']) ??
              Object.values(rec)[0];
            const countRaw =
              pickField(rec, ['count', 'COUNT', 'Count']) ??
              Object.values(rec)[1] ??
              0;
            return { value, count: toNumber(countRaw) };
          }),
        );
        setElapsed((profileRes.elapsed ?? 0) + (topRes.elapsed ?? 0));
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
        void cancelQuery(`${rid}-p`).catch(() => {});
        void cancelQuery(`${rid}-t`).catch(() => {});
        requestIdRef.current = null;
      }
    };
  }, [open, column, context, sqlWhere, t]);

  const nullPct =
    stats && stats.total > 0
      ? ((stats.nullCount / stats.total) * 100).toFixed(2)
      : '0';

  const displayTop = topRows.map((r) => ({
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
            Column profile: <code className="text-sm">{column}</code>
          </Trans>
        ) : (
          <Trans>Column profile</Trans>
        )
      }
      className="min-w-[min(720px,90vw)] h-[min(560px,90vh)]"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-2">
        {sql ? (
          <div className="shrink-0 max-h-20 overflow-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all select-text">
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
            <div className="grid shrink-0 grid-cols-2 gap-2 text-xs sm:grid-cols-5">
              <StatCard label={t`Total`} value={stats?.total ?? '—'} />
              <StatCard
                label={t`Nulls`}
                value={
                  stats
                    ? `${stats.nullCount} (${nullPct}%)`
                    : '—'
                }
              />
              <StatCard
                label={t`Distinct`}
                value={stats?.distinctCount ?? '—'}
              />
              <StatCard
                label={t`Min`}
                value={
                  stats?.minValue == null
                    ? '<null>'
                    : String(stats.minValue)
                }
              />
              <StatCard
                label={t`Max`}
                value={
                  stats?.maxValue == null
                    ? '<null>'
                    : String(stats.maxValue)
                }
              />
            </div>
            <div className="flex shrink-0 items-center justify-between text-xs text-muted-foreground">
              <span>
                <Trans>Top values</Trans>
              </span>
              {elapsed != null ? (
                <span>
                  <Trans>elapsed: {elapsed}ms</Trans>
                </span>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
              {displayTop.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  <Trans>No rows</Trans>
                </div>
              ) : (
                <SimpleTable data={displayTop} />
              )}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className="truncate font-mono font-medium" title={String(value)}>
        {value}
      </div>
    </div>
  );
}

void msg`Column profile`;
