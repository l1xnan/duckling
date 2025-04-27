import * as _ from 'es-toolkit';
import { max as _max, min as _min } from 'es-toolkit/compat';

export class DataFrame {
  private data: object[];
  private columns: string[];
  public inds = ['max', 'min', 'avg', 'sum', 'count'];

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

  private getColumnValues(column: string): number[] {
    return this.data.map((row) => (row as { [key: string]: any })[column]);
  }

  public stats(column: string): {
    max?: number;
    min?: number;
    avg: number;
    median: number;
    sum: number;
    count: number;
  } {
    const vals = this.getColumnValues(column).map((v) =>
      typeof v === 'string' ? String(v) : Number(v),
    );

    const nums = vals.map((v) => Number(v));

    return {
      max: _max(vals as number[]),
      min: _min(vals as number[]),
      avg: _.round(_.mean(nums), 6),
      median: _.median(nums),
      sum: _.sum(nums),
      count: vals.length,
    };
  }
  public statsAll(): Record<string, unknown>[] {
    return this.getColumns().map((column) => {
      return { field: column, ...this.stats(column) };
    });
  }

  public getColumns(): string[] {
    return this.columns;
  }
}
