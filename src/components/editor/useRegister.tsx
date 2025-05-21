import { Monaco, useMonaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useRef } from 'react';
import {
  registerUriBasedCompletionProvider,
  removeCompletionsForUri,
  setCompletionsForUri,
} from './monacoConfig'; // Adjust path

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

export function useRegister({ language = 'sql', completeMeta = {} }) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>(null);
  const instanceId = useRef(nanoid());

  const monaco = useMonaco();
  const modelUriRef = useRef<string>(null); // Store the model URI string

  // 1. Ensure the global provider for the language is registered
  useEffect(() => {
    if (monaco) {
      // Registering multiple times is safe due to checks inside the function
      // You might store the disposable if you need fine-grained control, but often not necessary
      registerUriBasedCompletionProvider(language);
    }
  }, [monaco, language]);

  // 2. Editor Mount: Get Model URI and register completion source
  const handleEditorDidMount = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor, _monaco: Monaco) => {
      editorRef.current = editor;
      const model = editor.getModel();
      if (model) {
        const currentModelUri = model.uri.toString();
        modelUriRef.current = currentModelUri; // Store URI for cleanup
      }
    },
    [],
  );

  const currentModelUri = modelUriRef.current;
  useEffect(() => {
    if (currentModelUri) {
      setCompletionsForUri(currentModelUri, completeMeta);
    }
  }, [completeMeta, currentModelUri]);

  // 3. Cleanup: Remove completion source for this URI on unmount
  useEffect(() => {
    // Return the cleanup function
    return () => {
      if (modelUriRef.current) {
        removeCompletionsForUri(modelUriRef.current);
        modelUriRef.current = null; // Clear the ref
      }
      editorRef.current = null; // Clean up editor ref
    };
  }, []);

  return {
    handleEditorDidMount,
    language,
    editorRef,
    instanceId,
  };
}
