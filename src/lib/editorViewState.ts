export type EditorViewStateSnapshot = {
  scrollLeft: number;
  firstLine: number;
  firstColumn: number;
  firstPositionDeltaTop: number;
  cursorLine: number;
  cursorColumn: number;
  selectionStartLine: number;
  selectionStartColumn: number;
  inSelectionMode: boolean;
};

export type MonacoViewStateLike = {
  cursorState?: Array<{
    inSelectionMode: boolean;
    selectionStart: { lineNumber: number; column: number };
    position: { lineNumber: number; column: number };
  }>;
  viewState?: {
    scrollLeft?: number;
    firstPosition?: { lineNumber: number; column: number };
    firstPositionDeltaTop?: number;
  };
  contributionsState?: Record<string, unknown>;
};

const MIN_VISIBLE_PX = 16;

export function editorHasVisibleLayout(layout: {
  width: number;
  height: number;
}): boolean {
  return layout.width >= MIN_VISIBLE_PX && layout.height >= MIN_VISIBLE_PX;
}

export function snapshotFromMonaco(
  vs: MonacoViewStateLike | null | undefined,
): EditorViewStateSnapshot | null {
  const first = vs?.viewState?.firstPosition;
  if (!first || first.lineNumber < 1 || first.column < 1) {
    return null;
  }
  const cursor = vs?.cursorState?.[0];
  const cursorPos = cursor?.position ?? first;
  const selectionStart = cursor?.selectionStart ?? cursorPos;
  return {
    scrollLeft: vs?.viewState?.scrollLeft ?? 0,
    firstLine: first.lineNumber,
    firstColumn: first.column,
    firstPositionDeltaTop: vs?.viewState?.firstPositionDeltaTop ?? 0,
    cursorLine: cursorPos.lineNumber,
    cursorColumn: cursorPos.column,
    selectionStartLine: selectionStart.lineNumber,
    selectionStartColumn: selectionStart.column,
    inSelectionMode: cursor?.inSelectionMode ?? false,
  };
}

export function snapshotToMonaco(
  snap: EditorViewStateSnapshot,
): MonacoViewStateLike {
  return {
    cursorState: [
      {
        inSelectionMode: snap.inSelectionMode,
        selectionStart: {
          lineNumber: snap.selectionStartLine,
          column: snap.selectionStartColumn,
        },
        position: {
          lineNumber: snap.cursorLine,
          column: snap.cursorColumn,
        },
      },
    ],
    viewState: {
      scrollLeft: snap.scrollLeft,
      firstPosition: {
        lineNumber: snap.firstLine,
        column: snap.firstColumn,
      },
      firstPositionDeltaTop: snap.firstPositionDeltaTop,
    },
    contributionsState: {},
  };
}

export function clampViewStateSnapshot(
  snap: EditorViewStateSnapshot,
  lineCount: number,
): EditorViewStateSnapshot {
  const maxLine = Math.max(1, lineCount);
  const clampLine = (line: number) => Math.min(Math.max(1, line), maxLine);
  const clampCol = (col: number) => Math.max(1, col);
  return {
    ...snap,
    firstLine: clampLine(snap.firstLine),
    firstColumn: clampCol(snap.firstColumn),
    cursorLine: clampLine(snap.cursorLine),
    cursorColumn: clampCol(snap.cursorColumn),
    selectionStartLine: clampLine(snap.selectionStartLine),
    selectionStartColumn: clampCol(snap.selectionStartColumn),
  };
}

export function isOriginViewState(snap: EditorViewStateSnapshot): boolean {
  return snap.firstLine <= 1 && snap.cursorLine <= 1 && snap.scrollLeft === 0;
}

export function viewStateFitsDocument(
  snap: EditorViewStateSnapshot,
  lineCount: number,
): boolean {
  if (lineCount < 1) {
    return false;
  }
  if (snap.firstLine <= 1 && snap.cursorLine <= 1) {
    return true;
  }
  return lineCount >= snap.firstLine && lineCount >= snap.cursorLine;
}

export function canCommitViewState(input: {
  active: boolean;
  userInteracted: boolean;
  previous?: EditorViewStateSnapshot;
  next: EditorViewStateSnapshot;
}): boolean {
  if (!input.active) {
    return false;
  }
  if (
    input.previous &&
    !isOriginViewState(input.previous) &&
    isOriginViewState(input.next) &&
    !input.userInteracted
  ) {
    return false;
  }
  return true;
}

export function pickStoredViewState(
  a?: EditorViewStateSnapshot,
  b?: EditorViewStateSnapshot,
): EditorViewStateSnapshot | undefined {
  if (a && b) {
    if (isOriginViewState(a) && !isOriginViewState(b)) {
      return b;
    }
    if (isOriginViewState(b) && !isOriginViewState(a)) {
      return a;
    }
    return a;
  }
  return a ?? b;
}

export function viewStateLooksRestored(
  expected: EditorViewStateSnapshot,
  visible: { startLineNumber: number } | undefined | null,
): boolean {
  if (!visible) {
    return false;
  }
  return Math.abs(visible.startLineNumber - expected.firstLine) <= 2;
}

export function viewStatesEqual(
  a: EditorViewStateSnapshot | undefined,
  b: EditorViewStateSnapshot,
): boolean {
  if (!a) {
    return false;
  }
  return (
    a.scrollLeft === b.scrollLeft &&
    a.firstLine === b.firstLine &&
    a.firstColumn === b.firstColumn &&
    a.firstPositionDeltaTop === b.firstPositionDeltaTop &&
    a.cursorLine === b.cursorLine &&
    a.cursorColumn === b.cursorColumn &&
    a.selectionStartLine === b.selectionStartLine &&
    a.selectionStartColumn === b.selectionStartColumn &&
    a.inSelectionMode === b.inSelectionMode
  );
}
