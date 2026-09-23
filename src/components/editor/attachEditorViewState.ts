import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import {
  canCommitViewState,
  clampViewStateSnapshot,
  editorHasVisibleLayout,
  isOriginViewState,
  pickStoredViewState,
  snapshotFromMonaco,
  snapshotToMonaco,
  viewStateFitsDocument,
  viewStateLooksRestored,
  type EditorViewStateSnapshot,
} from '@/lib/editorViewState';
import { useEditorSqlErrorStore } from '@/stores/editorSqlError';
import { useEditorViewStateStore } from '@/stores/editorViewState';
import { useTabsStore, type EditorContextType } from '@/stores/tabs';

const SAVE_DEBOUNCE_MS = 250;
const RESTORE_INTERVAL_MS = 50;
const RESTORE_WINDOW_MS = 3000;

export type EditorViewStateHandle = {
  dispose: () => void;
  setActive: (active: boolean) => void;
};

function readStoredSnapshot(
  editorId: string,
): EditorViewStateSnapshot | undefined {
  const tab = useTabsStore.getState().tabs[editorId];
  const fromTab =
    tab?.type === 'editor'
      ? (tab as EditorContextType).viewState
      : undefined;
  return pickStoredViewState(
    useEditorViewStateStore.getState().byEditor[editorId],
    fromTab,
  );
}

function editorDomVisible(
  editor: monaco.editor.IStandaloneCodeEditor,
): boolean {
  const node = editor.getDomNode() ?? editor.getContainerDomNode();
  return editorHasVisibleLayout({
    width: node?.offsetWidth ?? 0,
    height: node?.offsetHeight ?? 0,
  });
}

function applySnapshot(
  editor: monaco.editor.IStandaloneCodeEditor,
  snap: EditorViewStateSnapshot,
): boolean {
  const model = editor.getModel();
  if (!model || !viewStateFitsDocument(snap, model.getLineCount())) {
    return false;
  }
  if (!editorDomVisible(editor)) {
    return false;
  }
  const clamped = clampViewStateSnapshot(snap, model.getLineCount());
  editor.restoreViewState(
    snapshotToMonaco(clamped) as monaco.editor.ICodeEditorViewState,
  );
  editor.setScrollTop(
    editor.getTopForLineNumber(clamped.firstLine) +
      clamped.firstPositionDeltaTop,
  );
  editor.setScrollLeft(clamped.scrollLeft);
  return true;
}

export function attachEditorViewState(
  editor: monaco.editor.IStandaloneCodeEditor,
  editorId: string,
  initiallyActive = true,
): EditorViewStateHandle {
  let lastGood = readStoredSnapshot(editorId);
  let saveTimer = 0;
  let restoreTimer = 0;
  let restoreDeadline = 0;
  let restoring = false;
  let disposed = false;
  let active = initiallyActive;
  let userInteracted = false;

  const persistNow = (snap: EditorViewStateSnapshot) => {
    lastGood = snap;
    useEditorViewStateStore.getState().setViewState(editorId, snap);
  };

  const captureLive = (): EditorViewStateSnapshot | undefined => {
    if (!active || !editorDomVisible(editor)) {
      return lastGood;
    }
    const snap = snapshotFromMonaco(editor.saveViewState());
    if (!snap) {
      return lastGood;
    }
    if (
      !canCommitViewState({
        active,
        userInteracted,
        previous: lastGood,
        next: snap,
      })
    ) {
      return lastGood;
    }
    lastGood = snap;
    return snap;
  };

  const verified = (): boolean => {
    if (!lastGood || isOriginViewState(lastGood)) {
      return true;
    }
    return viewStateLooksRestored(lastGood, editor.getVisibleRanges()[0]);
  };

  const stopRestore = () => {
    if (restoreTimer) {
      window.clearTimeout(restoreTimer);
      restoreTimer = 0;
    }
    restoring = false;
  };

  const restore = () => {
    if (disposed || !active) {
      return false;
    }
    if (useEditorSqlErrorStore.getState().byEditor[editorId]) {
      return false;
    }
    const snap = lastGood ?? readStoredSnapshot(editorId);
    if (!snap || isOriginViewState(snap)) {
      return false;
    }
    lastGood = snap;
    return applySnapshot(editor, snap);
  };

  const startRestore = () => {
    if (disposed || !active || userInteracted) {
      return;
    }
    lastGood = readStoredSnapshot(editorId) ?? lastGood;
    if (!lastGood || isOriginViewState(lastGood)) {
      return;
    }
    restoreDeadline = performance.now() + RESTORE_WINDOW_MS;
    if (restoring) {
      return;
    }
    restoring = true;
    const step = () => {
      if (disposed || !active || userInteracted) {
        stopRestore();
        return;
      }
      editor.layout();
      restore();
      if (verified() || performance.now() >= restoreDeadline) {
        stopRestore();
        return;
      }
      restoreTimer = window.setTimeout(step, RESTORE_INTERVAL_MS);
    };
    step();
  };

  const scheduleSave = () => {
    if (!active || restoring) {
      return;
    }
    const snap = captureLive();
    if (!snap) {
      return;
    }
    if (saveTimer) {
      window.clearTimeout(saveTimer);
    }
    saveTimer = window.setTimeout(() => {
      saveTimer = 0;
      persistNow(snap);
    }, SAVE_DEBOUNCE_MS);
  };

  const flushNow = () => {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
    }
    if (active) {
      const snap = captureLive();
      if (snap) {
        persistNow(snap);
        return;
      }
    }
    if (lastGood) {
      persistNow(lastGood);
    }
  };

  if (active && lastGood && !isOriginViewState(lastGood)) {
    startRestore();
  }

  const markUser = () => {
    if (disposed || !active) {
      return;
    }
    userInteracted = true;
    stopRestore();
    scheduleSave();
  };

  const container = editor.getContainerDomNode();
  const inputOpts: AddEventListenerOptions = { capture: true, passive: true };
  container.addEventListener('wheel', markUser, inputOpts);
  container.addEventListener('pointerdown', markUser, inputOpts);
  container.addEventListener('keydown', markUser, inputOpts);

  const dScroll = editor.onDidScrollChange(() => {
    if (!active || restoring || !userInteracted) {
      return;
    }
    scheduleSave();
  });
  const dCursor = editor.onDidChangeCursorPosition(() => {
    if (!active || restoring || !userInteracted) {
      return;
    }
    scheduleSave();
  });
  const dContent = editor.onDidChangeModelContent(() => {
    if (active && lastGood && !userInteracted && !isOriginViewState(lastGood)) {
      startRestore();
    }
  });
  let wasDomVisible = editorDomVisible(editor);
  const dLayout = editor.onDidLayoutChange(() => {
    const visible = editorDomVisible(editor);
    if (
      active &&
      visible &&
      !wasDomVisible &&
      lastGood &&
      !isOriginViewState(lastGood) &&
      !userInteracted
    ) {
      startRestore();
    }
    wasDomVisible = visible;
  });

  const unsubHydrate = useEditorViewStateStore.persist.onFinishHydration(
    () => {
      lastGood = readStoredSnapshot(editorId) ?? lastGood;
      if (active && lastGood && !userInteracted) {
        startRestore();
      }
    },
  );

  window.addEventListener('pagehide', flushNow);
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      flushNow();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    flushNow();
    stopRestore();
    dScroll.dispose();
    dCursor.dispose();
    dContent.dispose();
    dLayout.dispose();
    container.removeEventListener('wheel', markUser, inputOpts);
    container.removeEventListener('pointerdown', markUser, inputOpts);
    container.removeEventListener('keydown', markUser, inputOpts);
    window.removeEventListener('pagehide', flushNow);
    document.removeEventListener('visibilitychange', onVisibility);
    if (typeof unsubHydrate === 'function') {
      unsubHydrate();
    }
  };

  return {
    dispose,
    setActive: (next) => {
      if (disposed || next === active) {
        return;
      }
      active = next;
      if (next) {
        userInteracted = false;
        lastGood = readStoredSnapshot(editorId) ?? lastGood;
        editor.layout();
        wasDomVisible = editorDomVisible(editor);
        if (lastGood && !isOriginViewState(lastGood)) {
          startRestore();
        }
      } else {
        flushNow();
        stopRestore();
        wasDomVisible = false;
      }
    },
  };
}
