import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';

import { query } from '@/api';
import Dialog from '@/components/custom/Dialog';
import { SimpleTable } from '@/components/tables';
import { Loading } from '@/components/views/TableView';
import { buildCountByColumnSql } from '@/lib/sql/countByColumn';
import {
  getDatabase,
  getParams,
  type TableContextType,
} from '@/stores/tabs';

export type CountByColumnDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column?: string;
  context: TableContextType;
  sqlWhere?: string;
};

type CountRow = {
  value: unknown;
  count: number;
};

export function CountByColumnDialog({
  open,
  onOpenChange,
  column,
  context,
  sqlWhere,
}: CountByColumnDialogProps) {
  const { t } = useLingui();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CountRow[]>([]);
  const [sql, setSql] = useState<string>('');
  const [elapsed, setElapsed] = useState<number | undefined>();

  useEffect(() => {
    if (!open || !column) {
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setRows([]);
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

        const countSql = buildCountByColumnSql({
          tableExpr: param.table,
          column,
          dialect: dialectName,
          where: sqlWhere,
          limit: 1000,
        });
        setSql(countSql);

        const res = await query({
          sql: countSql,
          dialect: param.dialect,
          limit: 0,
          offset: 0,
        });

        if (cancelled) return;

        if (res.code && res.code !== 0) {
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
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, column, context, sqlWhere, t]);

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
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Loading className="h-40" />
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

// keep msg for potential catalog extraction
void msg`Count by this column`;
