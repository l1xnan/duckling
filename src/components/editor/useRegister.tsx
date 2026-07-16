import { Monaco, useMonaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useRef } from 'react';

import { DialectType } from '@/stores/dbList';

import {
  registerSqlFormattingProvider,
  registerUriBasedCompletionProvider,
  removeCompletionsForUri,
  setCompletionsForUri,
  setDialectForUri,
} from './monacoConfig';

export const sqlWhereKeywords = [
  'AND',
  'OR',
  'NOT',
  'NULL',
  'IS',
  'LIKE',
  'IN',
  'BETWEEN',
  'EXISTS',
  'TRUE',
  'FALSE',
];
export const sqlComparisonOperators = ['=', '>', '<', '>=', '<=', '<>', '!='];

export function useRegister({
  language = 'sql',
  completeMeta = {},
  dialect,
}: {
  language?: string;
  completeMeta?: object;
  dialect?: DialectType;
}) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>(null);
  const instanceId = useRef(nanoid());
  const monacoApi = useMonaco();
  const modelUriRef = useRef<string | null>(null);

  useEffect(() => {
    if (monacoApi) {
      registerUriBasedCompletionProvider(language);
      if (language === 'sql') {
        registerSqlFormattingProvider(language);
      }
    }
  }, [monacoApi, language]);

  const handleEditorDidMount = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor, _monaco: Monaco) => {
      editorRef.current = editor;
      const model = editor.getModel();
      if (model) {
        const uri = model.uri.toString();
        modelUriRef.current = uri;
        setCompletionsForUri(uri, completeMeta);
        setDialectForUri(uri, dialect);
      }
    },
    [completeMeta, dialect],
  );

  useEffect(() => {
    if (modelUriRef.current) {
      setCompletionsForUri(modelUriRef.current, completeMeta);
    }
  }, [completeMeta]);

  useEffect(() => {
    if (modelUriRef.current) {
      setDialectForUri(modelUriRef.current, dialect);
    }
  }, [dialect]);

  useEffect(() => {
    return () => {
      if (modelUriRef.current) {
        removeCompletionsForUri(modelUriRef.current);
        modelUriRef.current = null;
      }
      editorRef.current = null;
    };
  }, []);

  return {
    handleEditorDidMount,
    language,
    editorRef,
    instanceId,
  };
}
