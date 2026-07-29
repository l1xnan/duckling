import { Monaco, useMonaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useRef } from 'react';

import { DialectType } from '@/stores/dbList';

import type { CompleteMetaType } from '@/ast/analyze';

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

function completionMetaFingerprint(meta: CompleteMetaType): string {
  const tables = meta.tables ?? {};
  const parts: string[] = [];
  for (const [db, tbls] of Object.entries(tables)) {
    for (const [table, cols] of Object.entries(tbls ?? {})) {
      const colSig = (cols ?? [])
        .map((c) => `${c.name}:${c.type ?? ''}`)
        .join(',');
      parts.push(`${db}\0${table}\0${colSig}`);
    }
  }
  parts.sort();
  return `${meta.prefixCode ?? ''}|${parts.join('|')}`;
}

export function useRegister({
  language = 'sql',
  completeMeta = {},
  dialect,
}: {
  language?: string;
  completeMeta?: CompleteMetaType;
  dialect?: DialectType;
}) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>(null);
  const instanceId = useRef(nanoid());
  const monacoApi = useMonaco();
  const modelUriRef = useRef<string | null>(null);
  const metaFingerprintRef = useRef<string>('');

  const applyCompleteMeta = useCallback(
    (uri: string, meta: CompleteMetaType) => {
      const fp = completionMetaFingerprint(meta);
      if (fp === metaFingerprintRef.current) {
        return;
      }
      metaFingerprintRef.current = fp;
      setCompletionsForUri(uri, meta);
    },
    [],
  );

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
        applyCompleteMeta(uri, completeMeta as CompleteMetaType);
        setDialectForUri(uri, dialect);
      }
    },
    [applyCompleteMeta, completeMeta, dialect],
  );

  useEffect(() => {
    if (modelUriRef.current) {
      applyCompleteMeta(modelUriRef.current, completeMeta as CompleteMetaType);
    }
  }, [applyCompleteMeta, completeMeta]);

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
