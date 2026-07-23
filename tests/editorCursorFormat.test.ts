import { describe, expect, it } from 'vitest';

import {
  cursorStateFromMonaco,
  cursorStatesEqual,
  editorCursorFormatParts,
  formatEditorCursorLabel,
} from '@/lib/editorCursorFormat';

function sel(
  startLine: number,
  startCol: number,
  endLine: number,
  endCol: number,
  empty = false,
) {
  return {
    startLineNumber: startLine,
    startColumn: startCol,
    endLineNumber: endLine,
    endColumn: endCol,
    isEmpty: () => empty,
  };
}

describe('editorCursorFormat', () => {
  it('empty selection is position-only', () => {
    const state = cursorStateFromMonaco({
      lineNumber: 3,
      column: 8,
      selection: sel(3, 8, 3, 8, true),
    });
    expect(state).toEqual({
      line: 3,
      column: 8,
      endLine: 3,
      endColumn: 8,
      selectedChars: 0,
    });
    expect(formatEditorCursorLabel(state)).toBe('Ln 3, Col 8');
    expect(editorCursorFormatParts(state)).toEqual({
      kind: 'position',
      line: 3,
      column: 8,
    });
  });

  it('single-line selection includes char count', () => {
    const state = cursorStateFromMonaco({
      lineNumber: 2,
      column: 1,
      selection: sel(2, 1, 2, 5),
      selectedText: 'abcd',
    });
    expect(state.selectedChars).toBe(4);
    expect(formatEditorCursorLabel(state)).toBe(
      'Ln 2, Col 1 (4 selected)',
    );
  });

  it('multi-line selection uses line range', () => {
    const state = cursorStateFromMonaco({
      lineNumber: 1,
      column: 1,
      selection: sel(1, 1, 4, 2),
      selectedText: 'a\nb\nc\nd',
    });
    expect(editorCursorFormatParts(state).kind).toBe('selection');
    expect(formatEditorCursorLabel(state)).toBe(
      'Ln 1–4 (7 selected)',
    );
  });

  it('normalizes reverse selection order', () => {
    const state = cursorStateFromMonaco({
      lineNumber: 5,
      column: 3,
      selection: sel(5, 10, 3, 1),
      selectedText: 'xx',
    });
    expect(state.line).toBe(3);
    expect(state.endLine).toBe(5);
  });

  it('cursorStatesEqual', () => {
    const a = {
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
      selectedChars: 0,
    };
    expect(cursorStatesEqual(a, { ...a })).toBe(true);
    expect(cursorStatesEqual(a, { ...a, column: 2 })).toBe(false);
    expect(cursorStatesEqual(undefined, a)).toBe(false);
  });
});
