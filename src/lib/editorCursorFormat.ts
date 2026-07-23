export type EditorCursorState = {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  selectedChars: number;
};

export type EditorCursorSelectionInput = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  isEmpty: () => boolean;
};

/** Build store state from Monaco position + selection (1-based). */
export function cursorStateFromMonaco(input: {
  lineNumber: number;
  column: number;
  selection: EditorCursorSelectionInput | null | undefined;
  selectedText?: string;
}): EditorCursorState {
  const sel = input.selection;
  const empty = !sel || sel.isEmpty();
  if (empty) {
    return {
      line: input.lineNumber,
      column: input.column,
      endLine: input.lineNumber,
      endColumn: input.column,
      selectedChars: 0,
    };
  }
  // Normalize so start is before end in document order
  let startLine = sel.startLineNumber;
  let startCol = sel.startColumn;
  let endLine = sel.endLineNumber;
  let endCol = sel.endColumn;
  if (
    endLine < startLine ||
    (endLine === startLine && endCol < startCol)
  ) {
    [startLine, endLine] = [endLine, startLine];
    [startCol, endCol] = [endCol, startCol];
  }
  return {
    line: startLine,
    column: startCol,
    endLine,
    endColumn: endCol,
    selectedChars: input.selectedText?.length ?? 0,
  };
}

export type EditorCursorFormatParts =
  | { kind: 'position'; line: number; column: number }
  | {
      kind: 'selection';
      line: number;
      column: number;
      endLine: number;
      endColumn: number;
      selectedChars: number;
      multiLine: boolean;
    };

export function editorCursorFormatParts(
  state: EditorCursorState,
): EditorCursorFormatParts {
  if (state.selectedChars <= 0) {
    return { kind: 'position', line: state.line, column: state.column };
  }
  const multiLine = state.endLine !== state.line;
  return {
    kind: 'selection',
    line: state.line,
    column: state.column,
    endLine: state.endLine,
    endColumn: state.endColumn,
    selectedChars: state.selectedChars,
    multiLine,
  };
}

/** English-oriented fallback string (tests / title); UI uses Lingui. */
export function formatEditorCursorLabel(state: EditorCursorState): string {
  const parts = editorCursorFormatParts(state);
  if (parts.kind === 'position') {
    return `Ln ${parts.line}, Col ${parts.column}`;
  }
  if (parts.multiLine) {
    return `Ln ${parts.line}–${parts.endLine} (${parts.selectedChars} selected)`;
  }
  return `Ln ${parts.line}, Col ${parts.column} (${parts.selectedChars} selected)`;
}

export function cursorStatesEqual(
  a: EditorCursorState | undefined,
  b: EditorCursorState,
): boolean {
  if (!a) {
    return false;
  }
  return (
    a.line === b.line &&
    a.column === b.column &&
    a.endLine === b.endLine &&
    a.endColumn === b.endColumn &&
    a.selectedChars === b.selectedChars
  );
}
