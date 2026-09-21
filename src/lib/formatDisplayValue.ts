import type { SchemaType } from '@/stores/dataset';

import {
  formatCellForGrid,
  type FieldFormatParamsType,
} from '@/components/tables/format';

export type DisplayFormatOptions = {
  beautify?: boolean;
  precision?: number;
};

export function findSchemaColumn(
  schema: SchemaType[] | undefined,
  name: string,
): SchemaType | undefined {
  return schema?.find((c) => c.name === name);
}

export function formatSchemaScalar(
  value: unknown,
  column: Pick<SchemaType, 'dataType' | 'type'> | undefined,
  options: DisplayFormatOptions = {},
): string {
  if (value == null || value === '') {
    return '<null>';
  }
  if (!column) {
    return formatAnalysisNumber(value, options) ?? String(value);
  }
  const params: Omit<FieldFormatParamsType, 'key'> = {
    dataType: column.dataType,
    type: column.type,
    beautify: options.beautify ?? true,
    precision: options.precision,
  };
  const out = formatCellForGrid(value, column.dataType, params);
  if (out === null || out === undefined) {
    return '<null>';
  }
  if (typeof out === 'number' && options.beautify && options.precision != null) {
    return formatAnalysisNumber(out, options) ?? String(out);
  }
  return String(out);
}

/** Format pivot / aggregate numbers when schema is unavailable. */
export function formatAnalysisNumber(
  value: unknown,
  options: DisplayFormatOptions,
): string | undefined {
  if (!options.beautify || options.precision == null) {
    return undefined;
  }
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'bigint'
        ? Number(value)
        : Number(value);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return n.toFixed(options.precision);
}

export function formatPivotDimensionRecords(
  records: Record<string, unknown>[],
  dimensionFields: string[],
  schema: SchemaType[],
  options: DisplayFormatOptions,
): Record<string, unknown>[] {
  if (!dimensionFields.length || !records.length) {
    return records;
  }
  const columns = new Map(
    dimensionFields.map((field) => [field, findSchemaColumn(schema, field)]),
  );
  return records.map((record) => {
    const next = { ...record };
    for (const field of dimensionFields) {
      if (!(field in next)) {
        continue;
      }
      const col = columns.get(field);
      const raw = next[field];
      if (raw == null || raw === '') {
        next[field] = raw;
        continue;
      }
      next[field] = col
        ? formatSchemaScalar(raw, col, options)
        : (formatAnalysisNumber(raw, options) ?? raw);
    }
    return next;
  });
}
