import { create } from 'zustand';

import {
  cursorStatesEqual,
  type EditorCursorState,
} from '@/lib/editorCursorFormat';

type EditorCursorStore = {
  byEditor: Record<string, EditorCursorState>;
  setCursor: (editorId: string, state: EditorCursorState) => void;
  clear: (editorId: string) => void;
};

export const useEditorCursorStore = create<EditorCursorStore>((set) => ({
  byEditor: {},
  setCursor: (editorId, state) =>
    set((s) => {
      if (cursorStatesEqual(s.byEditor[editorId], state)) {
        return s;
      }
      return {
        byEditor: { ...s.byEditor, [editorId]: state },
      };
    }),
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
