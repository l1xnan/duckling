import { Monaco, useMonaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  registerUriBasedCompletionProvider,
  removeCompletionsForUri,
  setCompletionsForUri,
} from './monacoConfig'; // Adjust path

export function useRegister({
  instanceId = nanoid(),
  language = 'sql',
  tableSchema = {},
}) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>(null);
  const monaco = useMonaco();
  const modelUriRef = useRef<string>(null); // Store the model URI string
  const completionDisposableRef = useRef<monaco.IDisposable>(null); // Store the provider disposable if needed

  // 1. Ensure the global provider for the language is registered
  useEffect(() => {
    if (monaco) {
      console.log(
        `[${instanceId}] Monaco ready. Ensuring provider for '${language}' is registered.`,
      );
      // Registering multiple times is safe due to checks inside the function
      // You might store the disposable if you need fine-grained control, but often not necessary
      completionDisposableRef.current =
        registerUriBasedCompletionProvider(language);
    }
    // Optional cleanup if you want to unregister the *global* provider on app exit
    // Usually not done per-component
    // return () => {
    //     completionDisposableRef.current?.dispose();
    // }
  }, [monaco, language, instanceId]);

  // 2. Create the completion source (function or array) for *this* instance
  // Use useMemo to avoid recreating the function on every render unless dependencies change
  // TODO:
  const completionSource = useMemo(() => {
    if (!monaco) return null; // Need monaco to create items/functions

    return tableSchema;
  }, [monaco, tableSchema, instanceId]);

  // 3. Editor Mount: Get Model URI and register completion source
  const handleEditorDidMount = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor, _monaco: Monaco) => {
      editorRef.current = editor;
      const model = editor.getModel();

      if (model && tableSchema) {
        const currentModelUri = model.uri.toString();
        modelUriRef.current = currentModelUri; // Store URI for cleanup

        console.log(
          `[${instanceId}] Editor mounted. Model URI: ${currentModelUri}. Setting completion source.`,
        );
        setCompletionsForUri(currentModelUri, tableSchema);

        // Optional: Log model content changes for debugging context
        // model.onDidChangeContent(e => {
        //     console.log(`[${instanceId}] Model content changed for ${currentModelUri}`);
        // });
      } else {
        console.error(
          `[${instanceId}] Editor mounted but model or completionSource is missing. Model: ${model}, Source: ${completionSource}`,
        );
      }
    },
    [instanceId, tableSchema],
  ); // Re-run if completionSource changes (due to props)

  // 4. Cleanup: Remove completion source for this URI on unmount
  useEffect(() => {
    // Return the cleanup function
    return () => {
      if (modelUriRef.current) {
        console.log(
          `[${instanceId}] Unmounting. Removing completion source for URI: ${modelUriRef.current}`,
        );
        removeCompletionsForUri(modelUriRef.current);
        modelUriRef.current = null; // Clear the ref
      }
      editorRef.current = null; // Clean up editor ref
    };
  }, [instanceId]); // Empty array ensures this runs only once on unmount

  // 5. Update: If completion source changes while mounted, update the registry
  useEffect(() => {
    // Ensure we only update if the editor is mounted and the URI/source are valid
    if (editorRef.current && modelUriRef.current && completionSource) {
      console.log(
        `[${instanceId}] Completion source changed. Updating registry for URI: ${modelUriRef.current}`,
      );
      setCompletionsForUri(modelUriRef.current, completionSource);
    }
  }, [completionSource]); // Dependency on the memoized completionSource

  return {
    handleEditorDidMount,
    language,
    instanceId,
  };
}
