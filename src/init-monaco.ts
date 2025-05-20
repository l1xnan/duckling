// from: monaco-editor/esm/vs/editor/editor.main.js
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js';
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';

// @ts-ignore
import * as monaco from 'monaco-editor/esm/vs/editor/edcore.main.js';
export * from 'monaco-editor/esm/vs/editor/editor.api.js';

import { loader } from '@monaco-editor/react';

loader.config({ monaco });

(globalThis as any).MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === 'json') {
      return new Worker(
        new URL(
          '../node_modules/monaco-editor/esm/vs/language/json/json.worker.js',
          import.meta.url,
        ),
        { type: 'module' },
      );
    }
    return new Worker(
      new URL(
        '../node_modules/monaco-editor/esm/vs/editor/editor.worker.js',
        import.meta.url,
      ),
      { type: 'module' },
    );
  },
};
