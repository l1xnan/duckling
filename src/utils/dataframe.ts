import * as _ from 'es-toolkit';
import { max as _max, min as _min } from 'es-toolkit/compat';

export class DataFrame {
  private data: object[];
  private columns: string[];
  public inds = [
    'max',
    'min',
    'avg',
    'sum',
    'count',
    'nulls',
    'null%',
    'distinct',
  ];

  constructor(data: object[]) {
    this.data = data;
    this.columns = this.extractColumns();
  }

  private extractColumns(): string[] {
    if (this.data.length === 0) {
      return [];
    }
    return Object.keys(this.data[0]);
  }

  private getColumnValues(column: string): unknown[] {
    return this.data.map((row) => (row as { [key: string]: unknown })[column]);
  }

  public stats(column: string): {
    max?: number;
    min?: number;
    avg: number;
    median: number;
    sum: number;
    count: number;
    nulls: number;
    'null%': string;
    distinct: number;
  } {
    const raw = this.getColumnValues(column);
    const nulls = raw.filter(
      (v) => v === null || v === undefined || v === '',
    ).length;
    const nonNull = raw.filter(
      (v) => v !== null && v !== undefined && v !== '',
    );
    const nums = nonNull
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));
    const distinct = new Set(
      nonNull.map((v) =>
        typeof v === 'object' ? JSON.stringify(v) : String(v),
      ),
    ).size;
    const total = raw.length;
    const nullPct =
      total > 0 ? ((nulls / total) * 100).toFixed(1) + '%' : '0%';

    return {
      max: nums.length ? _max(nums) : undefined,
      min: nums.length ? _min(nums) : undefined,
      avg: nums.length ? _.round(_.mean(nums), 6) : NaN,
      median: nums.length ? _.median(nums) : NaN,
      sum: nums.length ? _.sum(nums) : 0,
      count: total,
      nulls,
      'null%': nullPct,
      distinct,
    };
  }
  public statsAll(): Record<string, unknown>[] {
    return this.getColumns().map((column) => {
      return { field: column, ...this.stats(column) };
    });
  }

  /** Markdown summary for clipboard. */
  public statsMarkdown(): string {
    const rows = this.statsAll();
    if (!rows.length) return '';
    const headers = ['field', ...this.inds];
    const head = `| ${headers.join(' | ')} |`;
    const sep = `| ${headers.map(() => '---').join(' | ')} |`;
    const body = rows
      .map((row) => {
        const cells = headers.map((h) => {
          const v = row[h];
          return v == null || (typeof v === 'number' && Number.isNaN(v))
            ? '—'
            : String(v);
        });
        return `| ${cells.join(' | ')} |`;
      })
      .join('\n');
    return `${head}\n${sep}\n${body}`;
  }

  public getColumns(): string[] {
    return this.columns;
  }
}
