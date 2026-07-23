import { create } from 'zustand';

type EditorDirtyState = {
  dirty: Record<string, boolean>;
  setDirty: (id: string, dirty: boolean) => void;
  clear: (id: string) => void;
};

export const useEditorDirtyStore = create<EditorDirtyState>((set) => ({
  dirty: {},
  setDirty: (id, dirty) =>
    set((s) => {
      if (!!s.dirty[id] === dirty) {
        return s;
      }
      if (!dirty) {
        if (!(id in s.dirty)) {
          return s;
        }
        const next = { ...s.dirty };
        delete next[id];
        return { dirty: next };
      }
      return { dirty: { ...s.dirty, [id]: true } };
    }),
  clear: (id) =>
    set((s) => {
      if (!(id in s.dirty)) {
        return s;
      }
      const next = { ...s.dirty };
      delete next[id];
      return { dirty: next };
    }),
}));
