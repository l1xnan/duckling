import { create } from 'zustand';

import type { QueryContextType } from './tabs';

export type EditorSession = {
  activeKey?: string;
  children: QueryContextType[];
};

/** Stable fallbacks for selectors — never allocate in getSnapshot paths. */
export const EMPTY_CHILDREN: QueryContextType[] = [];
export const EMPTY_SESSION: EditorSession = { children: EMPTY_CHILDREN };

const emptySession = (): EditorSession => ({ children: [] });

type QuerySessionState = {
  byEditor: Record<string, EditorSession>;
  ensure: (editorId: string) => void;
  setActiveKey: (editorId: string, key?: string) => void;
  setChildren: (
    editorId: string,
    updater:
      | QueryContextType[]
      | ((prev: QueryContextType[]) => QueryContextType[]),
  ) => void;
  patchChild: (
    editorId: string,
    childId: string,
    partial:
      | Partial<QueryContextType>
      | ((prev: QueryContextType) => QueryContextType),
  ) => void;
  removeChild: (editorId: string, childId: string) => void;
  removeOtherChildren: (editorId: string, childId: string) => void;
  clearEditor: (editorId: string) => void;
};

function getSession(
  byEditor: Record<string, EditorSession>,
  editorId: string,
): EditorSession {
  return byEditor[editorId] ?? emptySession();
}

export const useQuerySessionStore = create<QuerySessionState>((set, get) => ({
  byEditor: {},

  ensure: (editorId) => {
    if (get().byEditor[editorId]) {
      return;
    }
    set((state) => ({
      byEditor: {
        ...state.byEditor,
        [editorId]: emptySession(),
      },
    }));
  },

  setActiveKey: (editorId, key) => {
    set((state) => {
      const prev = getSession(state.byEditor, editorId);
      return {
        byEditor: {
          ...state.byEditor,
          [editorId]: { ...prev, activeKey: key },
        },
      };
    });
  },

  setChildren: (editorId, updater) => {
    set((state) => {
      const prev = getSession(state.byEditor, editorId);
      const children =
        typeof updater === 'function' ? updater(prev.children) : updater;
      return {
        byEditor: {
          ...state.byEditor,
          [editorId]: { ...prev, children },
        },
      };
    });
  },

  patchChild: (editorId, childId, partial) => {
    set((state) => {
      const prev = getSession(state.byEditor, editorId);
      const children = prev.children.map((child) => {
        if (child.id !== childId) {
          return child;
        }
        if (typeof partial === 'function') {
          return partial(child);
        }
        return { ...child, ...partial };
      });
      return {
        byEditor: {
          ...state.byEditor,
          [editorId]: { ...prev, children },
        },
      };
    });
  },

  removeChild: (editorId, childId) => {
    set((state) => {
      const prev = getSession(state.byEditor, editorId);
      const delIndex = prev.children.findIndex((c) => c.id === childId);
      const children = prev.children.filter((c) => c.id !== childId);
      let activeKey = prev.activeKey;
      if (activeKey === childId) {
        activeKey =
          prev.children[delIndex - 1]?.id ||
          prev.children[delIndex + 1]?.id ||
          undefined;
      }
      return {
        byEditor: {
          ...state.byEditor,
          [editorId]: { ...prev, children, activeKey },
        },
      };
    });
  },

  removeOtherChildren: (editorId, childId) => {
    set((state) => {
      const prev = getSession(state.byEditor, editorId);
      return {
        byEditor: {
          ...state.byEditor,
          [editorId]: {
            ...prev,
            children: prev.children.filter((c) => c.id === childId),
            activeKey: childId,
          },
        },
      };
    });
  },

  clearEditor: (editorId) => {
    set((state) => {
      if (!(editorId in state.byEditor)) {
        return state;
      }
      const { [editorId]: _, ...rest } = state.byEditor;
      return { byEditor: rest };
    });
  },
}));

export function getQueryChild(
  editorId: string,
  queryId: string,
): QueryContextType | undefined {
  return useQuerySessionStore
    .getState()
    .byEditor[editorId]
    ?.children.find((c) => c.id === queryId);
}
