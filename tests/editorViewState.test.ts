import { describe, expect, it } from 'vitest';

import {
  canCommitViewState,
  clampViewStateSnapshot,
  editorHasVisibleLayout,
  pickStoredViewState,
  snapshotFromMonaco,
  snapshotToMonaco,
  viewStateFitsDocument,
  viewStateLooksRestored,
  viewStatesEqual,
  type EditorViewStateSnapshot,
} from '@/lib/editorViewState';

const sample: EditorViewStateSnapshot = {
  scrollLeft: 12,
  firstLine: 40,
  firstColumn: 1,
  firstPositionDeltaTop: -8,
  cursorLine: 42,
  cursorColumn: 5,
  selectionStartLine: 42,
  selectionStartColumn: 5,
  inSelectionMode: false,
};

describe('editorViewState', () => {
  it('round-trips monaco view state', () => {
    const vs = snapshotToMonaco(sample);
    expect(snapshotFromMonaco(vs)).toEqual(sample);
  });

  it('returns null when first position is missing', () => {
    expect(snapshotFromMonaco({})).toBeNull();
    expect(
      snapshotFromMonaco({
        viewState: { firstPosition: { lineNumber: 0, column: 1 } },
      }),
    ).toBeNull();
  });

  it('falls back to first position when cursor state is empty', () => {
    expect(
      snapshotFromMonaco({
        viewState: {
          scrollLeft: 3,
          firstPosition: { lineNumber: 9, column: 2 },
          firstPositionDeltaTop: 0,
        },
      }),
    ).toEqual({
      scrollLeft: 3,
      firstLine: 9,
      firstColumn: 2,
      firstPositionDeltaTop: 0,
      cursorLine: 9,
      cursorColumn: 2,
      selectionStartLine: 9,
      selectionStartColumn: 2,
      inSelectionMode: false,
    });
  });

  it('clamps lines to the document length', () => {
    expect(clampViewStateSnapshot(sample, 10)).toEqual({
      ...sample,
      firstLine: 10,
      cursorLine: 10,
      selectionStartLine: 10,
    });
  });

  it('treats sub-16px layouts as hidden', () => {
    expect(editorHasVisibleLayout({ width: 800, height: 200 })).toBe(true);
    expect(editorHasVisibleLayout({ width: 800, height: 0 })).toBe(false);
    expect(editorHasVisibleLayout({ width: 10, height: 200 })).toBe(false);
  });

  it('compares snapshots by fields', () => {
    expect(viewStatesEqual(undefined, sample)).toBe(false);
    expect(viewStatesEqual(sample, sample)).toBe(true);
    expect(
      viewStatesEqual(sample, { ...sample, firstPositionDeltaTop: -7 }),
    ).toBe(false);
  });

  it('rejects committing origin over a real position until the user moves', () => {
    expect(
      canCommitViewState({
        active: false,
        userInteracted: true,
        next: sample,
      }),
    ).toBe(false);
    expect(
      canCommitViewState({
        active: true,
        userInteracted: false,
        previous: sample,
        next: {
          ...sample,
          firstLine: 1,
          cursorLine: 1,
          scrollLeft: 0,
          firstPositionDeltaTop: 0,
        },
      }),
    ).toBe(false);
    expect(
      canCommitViewState({
        active: true,
        userInteracted: true,
        previous: sample,
        next: {
          ...sample,
          firstLine: 1,
          cursorLine: 1,
          scrollLeft: 0,
          firstPositionDeltaTop: 0,
        },
      }),
    ).toBe(true);
  });

  it('prefers a non-origin snapshot when picking stored state', () => {
    const origin = {
      ...sample,
      firstLine: 1,
      cursorLine: 1,
      scrollLeft: 0,
    };
    expect(pickStoredViewState(origin, sample)).toEqual(sample);
    expect(pickStoredViewState(sample, origin)).toEqual(sample);
  });

  it('waits until the document has enough lines before restoring', () => {
    expect(viewStateFitsDocument(sample, 1)).toBe(false);
    expect(viewStateFitsDocument(sample, 42)).toBe(true);
    expect(
      viewStateFitsDocument(
        { ...sample, firstLine: 1, cursorLine: 1 },
        1,
      ),
    ).toBe(true);
  });

  it('treats a nearby visible line as a successful restore', () => {
    expect(viewStateLooksRestored(sample, { startLineNumber: 40 })).toBe(true);
    expect(viewStateLooksRestored(sample, { startLineNumber: 42 })).toBe(true);
    expect(viewStateLooksRestored(sample, { startLineNumber: 1 })).toBe(false);
    expect(viewStateLooksRestored(sample, undefined)).toBe(false);
  });
});
