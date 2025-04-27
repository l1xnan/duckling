// @ts-ignore
import * as EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js';

import { worker } from 'monaco-sql-languages/esm/fillers/monaco-editor-core';

import { ICreateData } from 'monaco-sql-languages/esm/baseSQLWorker';
import { DuckDBWorker } from './duckdbWorker';

self.onmessage = () => {
  // ignore the first message
  EditorWorker.initialize(
    (ctx: worker.IWorkerContext, createData: ICreateData) => {
      return new DuckDBWorker(ctx, createData);
    },
  );
};
