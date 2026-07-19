import { create } from 'zustand';

import type { QueryContextType } from './tabs';

export type EditorSession = {
  activeKey?: string;
  /** Stable tab order (ids only). */
  order: string[];
  /** Per-query state for O(1) patch + fine-grained selectors. */
  byId: Record<string, QueryContextType>;
};

/** Stable fallbacks for selectors — never allocate in getSnapshot paths. */
export const EMPTY_ORDER: string[] = [];
export const EMPTY_BY_ID: Record<string, QueryContextType> = Object.freeze(
  {},
) as Record<string, QueryContextType>;
export const EMPTY_SESSION: EditorSession = Object.freeze({
  order: EMPTY_ORDER,
  byId: EMPTY_BY_ID,
});

/** @deprecated use EMPTY_ORDER — kept for re-exports */
export const EMPTY_CHILDREN = EMPTY_ORDER;

function emptySession(): EditorSession {
  return { order: [], byId: {} };
}

function sessionFromChildren(
  children: QueryContextType[],
  activeKey?: string,
): EditorSession {
  const order: string[] = [];
  const byId: Record<string, QueryContextType> = {};
  for (const child of children) {
    order.push(child.id);
    byId[child.id] = child;
  }
  return { order, byId, activeKey };
}

function orderedChildren(session: EditorSession): QueryContextType[] {
  return session.order
    .map((id) => session.byId[id])
    .filter((c): c is QueryContextType => c != null);
}

type QuerySessionState = {
  byEditor: Record<string, EditorSession>;
  ensure: (editorId: string) => void;
  setActiveKey: (editorId: string, key?: string) => void;
  /** Replace full child list (accepts array or updater over ordered list). */
  setChildren: (
    editorId: string,
    updater:
      | QueryContextType[]
      | ((prev: QueryContextType[]) => QueryContextType[]),
  ) => void;
  appendChild: (editorId: string, child: QueryContextType) => void;
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
  return byEditor[editorId] ?? EMPTY_SESSION;
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
      if (prev === EMPTY_SESSION && key === undefined) {
        return state;
      }
      const base = prev === EMPTY_SESSION ? emptySession() : prev;
      return {
        byEditor: {
          ...state.byEditor,
          [editorId]: { ...base, activeKey: key },
        },
      };
    });
  },

  setChildren: (editorId, updater) => {
    set((state) => {
      const prev = getSession(state.byEditor, editorId);
      const prevList = orderedChildren(prev);
      const children =
        typeof updater === 'function' ? updater(prevList) : updater;
      return {
        byEditor: {
          ...state.byEditor,
          [editorId]: sessionFromChildren(children, prev.activeKey),
        },
      };
    });
  },

  appendChild: (editorId, child) => {
    set((state) => {
      const prev = getSession(state.byEditor, editorId);
      const base = prev === EMPTY_SESSION ? emptySession() : prev;
      if (base.byId[child.id]) {
        return {
          byEditor: {
            ...state.byEditor,
            [editorId]: {
              ...base,
              byId: { ...base.byId, [child.id]: child },
            },
          },
        };
      }
      return {
        byEditor: {
          ...state.byEditor,
          [editorId]: {
            ...base,
            order: [...base.order, child.id],
            byId: { ...base.byId, [child.id]: child },
          },
        },
      };
    });
  },

  patchChild: (editorId, childId, partial) => {
    set((state) => {
      const prev = getSession(state.byEditor, editorId);
      const current = prev.byId[childId];
      if (!current) {
        return state;
      }
      const next =
        typeof partial === 'function'
          ? partial(current)
          : { ...current, ...partial };
      return {
        byEditor: {
          ...state.byEditor,
          [editorId]: {
            ...prev,
            byId: { ...prev.byId, [childId]: next },
          },
        },
      };
    });
  },

  removeChild: (editorId, childId) => {
    set((state) => {
      const prev = getSession(state.byEditor, editorId);
      if (!prev.byId[childId]) {
        return state;
      }
      const delIndex = prev.order.indexOf(childId);
      const order = prev.order.filter((id) => id !== childId);
      const { [childId]: _, ...byId } = prev.byId;
      let activeKey = prev.activeKey;
      if (activeKey === childId) {
        activeKey =
          prev.order[delIndex - 1] || prev.order[delIndex + 1] || undefined;
      }
      return {
        byEditor: {
          ...state.byEditor,
          [editorId]: { order, byId, activeKey },
        },
      };
    });
  },

  removeOtherChildren: (editorId, childId) => {
    set((state) => {
      const prev = getSession(state.byEditor, editorId);
      const child = prev.byId[childId];
      if (!child) {
        return state;
      }
      return {
        byEditor: {
          ...state.byEditor,
          [editorId]: {
            order: [childId],
            byId: { [childId]: child },
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
  return useQuerySessionStore.getState().byEditor[editorId]?.byId[queryId];
}

export function getOrderedChildren(
  editorId: string,
): QueryContextType[] {
  const session = useQuerySessionStore.getState().byEditor[editorId];
  if (!session) {
    return EMPTY_ORDER as unknown as QueryContextType[];
  }
  return orderedChildren(session);
}
