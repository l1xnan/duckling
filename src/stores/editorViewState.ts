import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  viewStatesEqual,
  type EditorViewStateSnapshot,
} from '@/lib/editorViewState';
import { editorViewStateFileStorage } from '@/stores/tauriStore';

type EditorViewStateStore = {
  byEditor: Record<string, EditorViewStateSnapshot>;
  setViewState: (editorId: string, snap: EditorViewStateSnapshot) => void;
  clear: (editorId: string) => void;
};

export const useEditorViewStateStore = create<EditorViewStateStore>()(
  persist(
    (set) => ({
      byEditor: {},
      setViewState: (editorId, snap) =>
        set((s) => {
          if (viewStatesEqual(s.byEditor[editorId], snap)) {
            return s;
          }
          return {
            byEditor: { ...s.byEditor, [editorId]: snap },
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
    }),
    {
      name: 'editor-view-state',
      storage: createJSONStorage(() => editorViewStateFileStorage),
      partialize: (s) => ({ byEditor: s.byEditor }),
    },
  ),
);
