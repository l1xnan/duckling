import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { PlusIcon, XIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cancelQuery, query } from '@/api';
import Dialog from '@/components/custom/Dialog';
import { PivotCanvasTable } from '@/components/tables/PivotCanvasTable';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loading } from '@/components/views/TableView';
import { isQueryErrorCode } from '@/lib/capabilities';
import { connectionRef, type DialectRef } from '@/lib/connectionRef';
import {
  buildPivotSql,
  DEFAULT_PIVOT_LIMIT,
  validatePivotConfig,
  type PivotAgg,
  type PivotConfig,
  type PivotMeasure,
  type PivotSource,
} from '@/lib/sql/pivot';
import { cn } from '@/lib/utils';
import type { SchemaType } from '@/stores/dataset';
import {
  getDatabase,
  getParams,
  type TableContextType,
} from '@/stores/tabs';
import { isNumberType } from '@/utils';

export type PivotDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: SchemaType[];
  /** Table browse source. */
  context?: TableContextType;
  sqlWhere?: string;
  /** Query result source (subquery). */
  dbId?: string;
  sourceSql?: string;
  /** Prefill a row dimension when opening from a column menu. */
  initialRowField?: string;
};

const AGG_OPTIONS: { value: PivotAgg; label: string }[] = [
  { value: 'count', label: 'COUNT' },
  { value: 'sum', label: 'SUM' },
  { value: 'avg', label: 'AVG' },
  { value: 'min', label: 'MIN' },
  { value: 'max', label: 'MAX' },
];

function defaultMeasure(columns: SchemaType[]): PivotMeasure {
  const numeric = columns.find((c) => isNumberType(c.dataType));
  if (numeric) {
    return { field: numeric.name, agg: 'sum' };
  }
  return { field: '*', agg: 'count' };
}

function normalizeRecords(
  rows: unknown[],
): Record<string, unknown>[] {
  return (rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'bigint') {
        out[k] = Number(v);
      } else {
        out[k] = v;
      }
    }
    return out;
  });
}

export function PivotDialog({
  open,
  onOpenChange,
  columns,
  context,
  sqlWhere,
  dbId,
  sourceSql,
  initialRowField,
}: PivotDialogProps) {
  const { t } = useLingui();
  const [rows, setRows] = useState<string[]>([]);
  const [colDims, setColDims] = useState<string[]>([]);
  const [measures, setMeasures] = useState<PivotMeasure[]>([
    { field: '*', agg: 'count' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [sql, setSql] = useState('');
  const [elapsed, setElapsed] = useState<number | undefined>();
  const [ranConfig, setRanConfig] = useState<PivotConfig | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  const fieldNames = useMemo(
    () => columns.map((c) => c.name),
    [columns],
  );

  const usedDims = useMemo(
    () => new Set([...rows, ...colDims]),
    [rows, colDims],
  );

  const availableFields = useMemo(
    () => fieldNames.filter((f) => !usedDims.has(f)),
    [fieldNames, usedDims],
  );

  const config: PivotConfig = useMemo(
    () => ({
      rows,
      columns: colDims,
      measures,
      where: sqlWhere,
      limit: DEFAULT_PIVOT_LIMIT,
    }),
    [rows, colDims, measures, sqlWhere],
  );

  const validation = useMemo(() => validatePivotConfig(config), [config]);

  // Reset config when dialog opens
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;

    const pref = initialRowField?.trim();
    setRows(pref && fieldNames.includes(pref) ? [pref] : []);
    setColDims([]);
    setMeasures([defaultMeasure(columns)]);
    setRecords([]);
    setSql('');
    setError(null);
    setElapsed(undefined);
    setRanConfig(null);
  }, [open, initialRowField, fieldNames, columns]);

  const handleCancel = async () => {
    const rid = requestIdRef.current;
    if (!rid) return;
    try {
      await cancelQuery(rid);
    } catch (e) {
      console.error(e);
    }
  };

  const addDim = (target: 'rows' | 'columns', field: string) => {
    if (!field || usedDims.has(field)) return;
    if (target === 'rows') {
      setRows((prev) => [...prev, field]);
    } else {
      setColDims((prev) => [...prev, field]);
    }
  };

  const removeDim = (target: 'rows' | 'columns', field: string) => {
    if (target === 'rows') {
      setRows((prev) => prev.filter((f) => f !== field));
    } else {
      setColDims((prev) => prev.filter((f) => f !== field));
    }
  };

  const moveDim = (
    from: 'rows' | 'columns',
    to: 'rows' | 'columns',
    field: string,
  ) => {
    if (from === to) return;
    removeDim(from, field);
    addDim(to, field);
  };

  const updateMeasure = (index: number, patch: Partial<PivotMeasure>) => {
    setMeasures((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    );
  };

  const addMeasure = () => {
    setMeasures((prev) => [...prev, defaultMeasure(columns)]);
  };

  const removeMeasure = (index: number) => {
    setMeasures((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
    );
  };

  const resolveSource = useCallback(async (): Promise<{
    source: PivotSource;
    dialectConn: DialectRef;
  }> => {
    if (sourceSql?.trim() && dbId) {
      const db = getDatabase(dbId);
      if (!db) {
        throw new Error(t`Connection not found`);
      }
      return {
        source: {
          kind: 'subquery',
          sourceSql,
          dialect: db.dialect ?? 'generic',
        },
        dialectConn: connectionRef(dbId),
      };
    }

    if (!context) {
      throw new Error(t`Could not resolve table for this view`);
    }

    const param = await getParams({
      type: context.type,
      dbId: context.dbId,
      tableId: context.tableId,
      tableName: context.tableName,
      page: 1,
      perPage: 500,
      sqlWhere,
    });

    if (!param || !('table' in param) || !param.table || !param.dialect) {
      throw new Error(t`Could not resolve table for this view`);
    }

    const dialectName =
      getDatabase(context.dbId)?.dialect ??
      (context.type === 'file' ? 'file' : 'generic');

    return {
      source: {
        kind: 'table',
        tableExpr: param.table,
        dialect: dialectName,
      },
      dialectConn: param.dialect,
    };
  }, [sourceSql, dbId, context, sqlWhere, t]);

  const handleRun = async () => {
    if (validation) {
      setError(validation.message);
      return;
    }

    const requestId = nanoid();
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    setRecords([]);
    setSql('');
    setElapsed(undefined);

    try {
      const { source, dialectConn } = await resolveSource();
      const pivotSql = buildPivotSql(config, source);
      setSql(pivotSql);
      setRanConfig({ ...config });

      const res = await query({
        sql: pivotSql,
        dialect: dialectConn,
        limit: 0,
        offset: 0,
        requestId,
      });

      if (isQueryErrorCode(res.code)) {
        setError(res.message || t`Query failed`);
        setElapsed(res.elapsed);
        return;
      }

      setRecords(normalizeRecords(res.data ?? []));
      setElapsed(res.elapsed);
    } catch (e) {
      const msgText = e instanceof Error ? e.message : String(e);
      if (msgText.toLowerCase().includes('cancel')) {
        setError(t`Query cancelled`);
      } else {
        setError(msgText);
      }
    } finally {
      setLoading(false);
      if (requestIdRef.current === requestId) {
        requestIdRef.current = null;
      }
    }
  };

  const fieldSelectItems = useMemo(
    () => availableFields.map((f) => ({ value: f, label: f })),
    [availableFields],
  );

  const allFieldItems = useMemo(
    () => [
      { value: '*', label: '*' },
      ...fieldNames.map((f) => ({ value: f, label: f })),
    ],
    [fieldNames],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Pivot table</Trans>}
      className="min-w-[min(960px,95vw)] h-[min(720px,92vh)] max-h-[min(720px,92vh)]"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-2">
        {/* Config */}
        <div className="grid shrink-0 gap-3 md:grid-cols-[1fr_1fr_1.2fr]">
          <DimPanel
            label={t`Rows`}
            fields={rows}
            available={availableFields}
            fieldItems={fieldSelectItems}
            onAdd={(f) => addDim('rows', f)}
            onRemove={(f) => removeDim('rows', f)}
            onMoveToColumns={(f) => moveDim('rows', 'columns', f)}
            moveLabel={t`Move to columns`}
          />
          <DimPanel
            label={t`Columns`}
            fields={colDims}
            available={availableFields}
            fieldItems={fieldSelectItems}
            onAdd={(f) => addDim('columns', f)}
            onRemove={(f) => removeDim('columns', f)}
            onMoveToColumns={(f) => moveDim('columns', 'rows', f)}
            moveLabel={t`Move to rows`}
          />
          <div className="flex min-h-0 flex-col gap-1.5 rounded-md border p-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                <Trans>Measures</Trans>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={addMeasure}
              >
                <PlusIcon className="size-3.5" />
                <Trans>Add</Trans>
              </Button>
            </div>
            <div className="flex max-h-28 flex-col gap-1.5 overflow-auto">
              {measures.map((m, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Select
                    value={m.agg}
                    onValueChange={(v) => {
                      const agg = (v as PivotAgg) ?? 'count';
                      updateMeasure(i, {
                        agg,
                        field:
                          agg === 'count' && !m.field ? '*' : m.field || '*',
                      });
                    }}
                    items={AGG_OPTIONS}
                  >
                    <SelectTrigger size="sm" className="w-[88px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {AGG_OPTIONS.map((item) => (
                          <SelectItem
                            key={item.value}
                            value={item.value}
                            label={item.label}
                          >
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select
                    value={m.field || '*'}
                    onValueChange={(v) =>
                      updateMeasure(i, { field: (v as string) ?? '*' })
                    }
                    items={allFieldItems}
                  >
                    <SelectTrigger size="sm" className="min-w-0 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {allFieldItems.map((item) => (
                          <SelectItem
                            key={item.value}
                            value={item.value}
                            label={item.label}
                          >
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={measures.length <= 1}
                    onClick={() => removeMeasure(i)}
                    aria-label={t`Remove measure`}
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!!validation || loading}
            onClick={() => {
              void handleRun();
            }}
          >
            <Trans>Run</Trans>
          </Button>
          {validation ? (
            <span className="text-xs text-muted-foreground">
              {validation.message}
            </span>
          ) : null}
          {elapsed != null && !loading ? (
            <span className="ml-auto text-xs text-muted-foreground">
              <Trans>elapsed: {elapsed}ms</Trans>
              {records.length > 0 ? (
                <>
                  {' · '}
                  <Trans>{records.length} group(s)</Trans>
                  {records.length >= DEFAULT_PIVOT_LIMIT ? (
                    <>
                      {' '}
                      <Trans>(capped at {DEFAULT_PIVOT_LIMIT})</Trans>
                    </>
                  ) : null}
                </>
              ) : null}
            </span>
          ) : null}
        </div>

        {sql ? (
          <div className="max-h-16 shrink-0 overflow-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all select-text">
            {sql}
          </div>
        ) : null}

        {/* Result */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
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
            <div className="m-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive select-text">
              {error}
            </div>
          ) : ranConfig && records.length > 0 ? (
            <PivotCanvasTable records={records} config={ranConfig} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {ranConfig ? (
                <Trans>No rows</Trans>
              ) : (
                <Trans>Configure dimensions and measures, then run</Trans>
              )}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function DimPanel({
  label,
  fields,
  available,
  fieldItems,
  onAdd,
  onRemove,
  onMoveToColumns,
  moveLabel,
}: {
  label: string;
  fields: string[];
  available: string[];
  fieldItems: { value: string; label: string }[];
  onAdd: (field: string) => void;
  onRemove: (field: string) => void;
  onMoveToColumns: (field: string) => void;
  moveLabel: string;
}) {
  const { t } = useLingui();
  const [pending, setPending] = useState<string | null>(null);

  return (
    <div className="flex min-h-0 flex-col gap-1.5 rounded-md border p-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex min-h-[28px] flex-wrap gap-1">
        {fields.length === 0 ? (
          <span className="text-xs text-muted-foreground/70">
            <Trans>None</Trans>
          </span>
        ) : (
          fields.map((f) => (
            <span
              key={f}
              className={cn(
                'inline-flex items-center gap-0.5 rounded-md border bg-muted/50 px-1.5 py-0.5 text-xs',
              )}
            >
              <button
                type="button"
                className="hover:text-primary"
                title={moveLabel}
                onClick={() => onMoveToColumns(f)}
              >
                {f}
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onRemove(f)}
                aria-label={t`Remove`}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))
        )}
      </div>
      {available.length > 0 ? (
        <div className="flex items-center gap-1">
          <Select
            value={pending ?? undefined}
            onValueChange={(v) => setPending((v as string) ?? null)}
            items={fieldItems}
          >
            <SelectTrigger size="sm" className="min-w-0 flex-1">
              <SelectValue placeholder={t`Add field…`} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {fieldItems.map((item) => (
                  <SelectItem
                    key={item.value}
                    value={item.value}
                    label={item.label}
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={!pending}
            onClick={() => {
              if (pending) {
                onAdd(pending);
                setPending(null);
              }
            }}
          >
            <PlusIcon className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// keep msg for catalog extraction
void msg`Pivot table`;
