import { Trans, useLingui } from '@lingui/react/macro';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cancelQuery, query } from '@/api';
import { SimpleBarChart } from '@/components/charts/SimpleBarChart';
import Dialog from '@/components/custom/Dialog';
import { SimpleTable } from '@/components/tables';
import { Button } from '@/components/custom/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/custom/ui/tabs';
import { Loading } from '@/components/views/TableView';
import { SqlPreview } from '@/components/views/SqlPreview';
import { isQueryErrorCode } from '@/lib/capabilities';
import { connectionRef } from '@/lib/connectionRef';
import {
  buildColumnProfileSql,
  buildColumnProfileSubquerySql,
} from '@/lib/sql/columnProfile';
import {
  buildCountByColumnSql,
  mapCountByRows,
  toCountByDisplayRows,
} from '@/lib/sql/countByColumn';
import { buildCountBySubquerySql } from '@/lib/sql/countBySubquery';
import {
  type ComputedColumn,
  resolveAnalysisTableExpr,
} from '@/lib/sql/computedColumns';
import {
  findSchemaColumn,
  formatSchemaScalar,
} from '@/lib/formatDisplayValue';
import type { SchemaType } from '@/stores/dataset';
import {
  getDatabase,
  getParams,
  type TableContextType,
} from '@/stores/tabs';
import { getDefaultPerPage, usePrecision } from '@/stores/setting';

const DISTRIBUTION_LIMIT = 1000;

type SharedProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column?: string;
  columns?: SchemaType[];
  beautify?: boolean;
  /** Apply the raw group value as a SQL predicate on the profiled column. */
  onFilterByValue?: (value: unknown) => void;
};

export type ColumnProfileDialogProps = SharedProps &
  (
    | {
        kind: 'table';
        context: TableContextType;
        sqlWhere?: string;
        computedColumns?: ComputedColumn[];
      }
    | {
        kind: 'query';
        dbId: string;
        sourceSql: string;
      }
  );

type ProfileStats = {
  total: number;
  nullCount: number;
  distinctCount: number;
  minValue: unknown;
  maxValue: unknown;
};

type CountRow = { value: unknown; count: number };

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

function parseProfileStats(row: Record<string, unknown>): ProfileStats {
  return {
    total: toNumber(pickField(row, ['total', 'TOTAL', 'Total'])),
    nullCount: toNumber(
      pickField(row, ['null_count', 'NULL_COUNT', 'Null_count']),
    ),
    distinctCount: toNumber(
      pickField(row, ['distinct_count', 'DISTINCT_COUNT', 'Distinct_count']),
    ),
    minValue: pickField(row, ['min_value', 'MIN_VALUE', 'Min_value']),
    maxValue: pickField(row, ['max_value', 'MAX_VALUE', 'Max_value']),
  };
}

export function ColumnProfileDialog(props: ColumnProfileDialogProps) {
  const {
    open,
    onOpenChange,
    column,
    columns,
    beautify = true,
    onFilterByValue,
    kind,
  } = props;
  const context = kind === 'table' ? props.context : undefined;
  const sqlWhere = kind === 'table' ? props.sqlWhere : undefined;
  const computedColumns = kind === 'table' ? props.computedColumns : undefined;
  const dbId = kind === 'query' ? props.dbId : undefined;
  const sourceSql = kind === 'query' ? props.sourceSql : '';

  const { t } = useLingui();
  const precision = usePrecision();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [rows, setRows] = useState<CountRow[]>([]);
  const [sql, setSql] = useState<string>('');
  const [elapsed, setElapsed] = useState<number | undefined>();
  const requestIdRef = useRef<string | null>(null);

  const handleCancel = async () => {
    const rid = requestIdRef.current;
    if (!rid) return;
    try {
      await Promise.all([
        cancelQuery(`${rid}-p`),
        cancelQuery(`${rid}-d`),
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!open || !column) return;
    if (kind === 'query' && !sourceSql.trim()) return;

    let cancelled = false;
    const requestId = nanoid();
    requestIdRef.current = requestId;

    (async () => {
      setLoading(true);
      setError(null);
      setStats(null);
      setRows([]);
      setSql('');
      setElapsed(undefined);

      try {
        let profileSql: string;
        let distSql: string;
        let dialect: Parameters<typeof query>[0]['dialect'];

        if (kind === 'table') {
          if (!context) {
            throw new Error(t`Could not resolve table for this view`);
          }
          const param = await getParams({
            type: context.type,
            dbId: context.dbId,
            tableId: context.tableId,
            tableName: context.tableName,
            page: 1,
            perPage: getDefaultPerPage(),
            sqlWhere,
            computedColumns,
          });

          if (!param || !('table' in param) || !param.table) {
            throw new Error(t`Could not resolve table for this view`);
          }

          const dialectName =
            getDatabase(context.dbId)?.dialect ??
            (context.type === 'file' ? 'file' : 'generic');
          const tableExpr = resolveAnalysisTableExpr(
            param.table,
            computedColumns,
            dialectName,
          );
          profileSql = buildColumnProfileSql({
            tableExpr,
            column,
            dialect: dialectName,
            where: sqlWhere,
          });
          distSql = buildCountByColumnSql({
            tableExpr,
            column,
            dialect: dialectName,
            where: sqlWhere,
            limit: DISTRIBUTION_LIMIT,
          });
          dialect = param.dialect;
        } else {
          if (!dbId) {
            throw new Error(t`Connection not found`);
          }
          const db = getDatabase(dbId);
          if (!db) {
            throw new Error(t`Connection not found`);
          }
          const dialectName = db.dialect ?? 'generic';
          profileSql = buildColumnProfileSubquerySql({
            sourceSql,
            column,
            dialect: dialectName,
          });
          distSql = buildCountBySubquerySql({
            sourceSql,
            column,
            dialect: dialectName,
            limit: DISTRIBUTION_LIMIT,
          });
          dialect = connectionRef(dbId);
        }

        setSql(`${profileSql};\n${distSql}`);

        const [profileRes, distRes] = await Promise.all([
          query({
            sql: profileSql,
            dialect,
            limit: 0,
            offset: 0,
            requestId: `${requestId}-p`,
          }),
          query({
            sql: distSql,
            dialect,
            limit: 0,
            offset: 0,
            requestId: `${requestId}-d`,
          }),
        ]);

        if (cancelled) return;

        if (isQueryErrorCode(profileRes.code)) {
          setError(profileRes.message || t`Query failed`);
          setElapsed(profileRes.elapsed);
          return;
        }
        if (isQueryErrorCode(distRes.code)) {
          setError(distRes.message || t`Query failed`);
          setElapsed(distRes.elapsed);
          return;
        }

        const row = (profileRes.data?.[0] ?? {}) as Record<string, unknown>;
        setStats(parseProfileStats(row));
        setRows(mapCountByRows(distRes.data ?? []));
        setElapsed((profileRes.elapsed ?? 0) + (distRes.elapsed ?? 0));
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
        void cancelQuery(`${rid}-d`).catch(() => {});
        requestIdRef.current = null;
      }
    };
  }, [
    open,
    column,
    kind,
    context,
    sqlWhere,
    computedColumns,
    dbId,
    sourceSql,
    t,
  ]);

  const columnSchema = useMemo(
    () => (column ? findSchemaColumn(columns, column) : undefined),
    [column, columns],
  );

  const formatValue = useCallback(
    (value: unknown) =>
      formatSchemaScalar(value, columnSchema, { beautify, precision }),
    [beautify, columnSchema, precision],
  );

  const handleFilterRow = useCallback(
    (record: Record<string, unknown>) => {
      if (!onFilterByValue) return;
      onFilterByValue(record.__raw);
      onOpenChange(false);
    },
    [onFilterByValue, onOpenChange],
  );

  const nullPct =
    stats && stats.total > 0
      ? ((stats.nullCount / stats.total) * 100).toFixed(2)
      : '0';

  const allRowsTotal = stats?.total ?? 0;
  const displayRows = toCountByDisplayRows(rows, allRowsTotal, formatValue).map(
    (row, index) => ({
      ...row,
      __raw: rows[index]?.value,
    }),
  );
  const capped = displayRows.length >= DISTRIBUTION_LIMIT;

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
      resizable={{
        defaultWidth: 720,
        defaultHeight: 560,
        minWidth: 480,
        minHeight: 360,
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-2">
        {sql ? <SqlPreview sql={sql} /> : null}

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
                  stats ? `${stats.nullCount} (${nullPct}%)` : '—'
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
                    : formatValue(stats.minValue)
                }
              />
              <StatCard
                label={t`Max`}
                value={
                  stats?.maxValue == null
                    ? '<null>'
                    : formatValue(stats.maxValue)
                }
              />
            </div>
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
                  <SimpleTable
                    data={displayRows}
                    filterField="value"
                    onFilterByValue={
                      onFilterByValue ? handleFilterRow : undefined
                    }
                  />
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
