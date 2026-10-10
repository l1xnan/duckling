/* eslint-disable import-x/export, import-x/default -- monaco's re-export-only
   entry points and Vite `?worker` modules are not statically enumerable. */
// 0.56 splits the ESM build into opt-in entry points: `monaco-editor/editor`
// is the editor API, features and language definitions are side-effect imports.
import * as monaco from 'monaco-editor/editor';
import 'monaco-editor/features/register.all';
// `features/register.all` omits these three contributions that the pre-0.56
// `esm/vs/editor/edcore.main.js` entry registered, so the full editor keeps them.
import 'monaco-editor/editor/contrib/caretOperations/browser/caretOperations.js';
import 'monaco-editor/editor/contrib/dropOrPasteInto/browser/copyPasteContribution.js';
import 'monaco-editor/editor/contrib/semanticTokens/browser/documentSemanticTokens.js';
import 'monaco-editor/languages/definitions/sql/register';
import 'monaco-editor/languages/features/json/register';

import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/languages/features/json/json.worker?worker';

import { loader } from '@monaco-editor/react';

export * from 'monaco-editor/editor';

loader.config({ monaco });

(globalThis as any).MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === 'json') {
      return new JsonWorker();
    }
    return new EditorWorker();
  },
};
