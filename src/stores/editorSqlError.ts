import { create } from 'zustand';

export type EditorSqlErrorState = {
  message: string;
  /** 1-based line in the editor document */
  line: number;
  /** 1-based column in the editor document */
  column: number;
};

type Store = {
  byEditor: Record<string, EditorSqlErrorState>;
  setError: (editorId: string, error: EditorSqlErrorState) => void;
  clear: (editorId: string) => void;
};

export const useEditorSqlErrorStore = create<Store>((set) => ({
  byEditor: {},
  setError: (editorId, error) =>
    set((s) => ({
      byEditor: { ...s.byEditor, [editorId]: error },
    })),
  clear: (editorId) =>
    set((s) => {
      if (!(editorId in s.byEditor)) {
        return s;
      }
      const next = { ...s.byEditor };
      delete next[editorId];
      return { byEditor: next };
    }),
}));

/** Map location relative to executed SQL into document coordinates. */
export function mapParseLocationToDocument(
  loc: { line: number; column: number },
  sourceRange?: {
    startLineNumber: number;
    startColumn: number;
  } | null,
): { line: number; column: number } {
  if (!sourceRange) {
    return { line: loc.line, column: loc.column };
  }
  const line = sourceRange.startLineNumber + loc.line - 1;
  const column =
    loc.line === 1
      ? sourceRange.startColumn + loc.column - 1
      : loc.column;
  return {
    line: Math.max(1, line),
    column: Math.max(1, column),
  };
}
