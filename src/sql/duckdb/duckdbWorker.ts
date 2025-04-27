import { PostgreSQL } from 'dt-sql-parser/dist/parser/postgresql';
import {
  BaseSQLWorker,
  ICreateData,
} from 'monaco-sql-languages/esm/baseSQLWorker';
import { worker } from 'monaco-sql-languages/esm/fillers/monaco-editor-core';

export class DuckDBWorker extends BaseSQLWorker {
  protected _ctx: worker.IWorkerContext;
  protected parser: PostgreSQL;
  constructor(ctx: worker.IWorkerContext, createData: ICreateData) {
    super(ctx, createData);
    this._ctx = ctx;
    this.parser = new PostgreSQL();
  }
}

export function create(
  ctx: worker.IWorkerContext,
  createData: ICreateData,
): DuckDBWorker {
  return new DuckDBWorker(ctx, createData);
}
