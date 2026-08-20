import { findLeaf, findLeafByTab } from '@/stores/tabLayout';
import { useTabsStore } from '@/stores/tabs';

export type VerticalTabDrop = {
  tabId: string;
  /** Insert-before index in the owning pane; undefined = append. */
  index?: number;
  beforeTabId?: string;
  placement?: 'before' | 'after';
};

type OpPos = {
  position?: {
    current?: { x?: number; y?: number };
    x?: number;
    y?: number;
  };
};

let grabOffsetY = 0;

export function setVerticalTabGrabOffsetY(offset: number) {
  grabOffsetY = offset;
}

export function resetVerticalTabGrabOffsetY() {
  grabOffsetY = 0;
}

function pointerY(operation?: OpPos): number | null {
  const pos = operation?.position;
  if (!pos) return null;
  if (typeof pos.current?.y === 'number') return pos.current.y;
  if (typeof pos.y === 'number') return pos.y;
  return null;
}

function ghostTopEdge(
  source: { element?: Element | null },
  operation?: OpPos,
): number | null {
  const y = pointerY(operation);
  if (y != null) return y - grabOffsetY;
  if (source.element instanceof Element) {
    return source.element.getBoundingClientRect().top;
  }
  return null;
}

function insertIndexFromGhostTop(
  paneId: string,
  dragTabId: string,
  ghostTop: number,
  allowedTabIds?: Set<string>,
): number {
  const leaf = findLeaf(useTabsStore.getState().layout, paneId);
  const tabIds = leaf?.tabIds ?? [];
  const prefix = 'vertical-tab-';

  const others = tabIds
    .filter((id) => id !== dragTabId && (!allowedTabIds || allowedTabIds.has(id)))
    .map((id) => {
      const el = document.getElementById(`${prefix}${id}`);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        storeIndex: tabIds.indexOf(id),
        center: rect.top + rect.height / 2,
      };
    })
    .filter((t): t is { storeIndex: number; center: number } => t != null)
    .sort((a, b) => a.center - b.center);

  for (const t of others) {
    if (ghostTop < t.center) return t.storeIndex;
  }
  return tabIds.length;
}

export function resolveVerticalTabDrop(
  source: unknown,
  target: unknown,
  operation?: OpPos,
  allowedTabIds?: Set<string>,
): VerticalTabDrop | null {
  if (!source || !target) return null;

  const sourceAny = source as {
    id?: string | number;
    data?: { type?: string; tabId?: string; group?: string };
    element?: Element | null;
  };
  const targetAny = target as {
    data?: { type?: string; tabId?: string; group?: string };
    element?: Element | null;
  };

  const sourceData = sourceAny.data ?? {};
  const tabId =
    sourceData.tabId ||
    (typeof sourceAny.id === 'string' ? sourceAny.id : undefined);
  if (!tabId || (sourceData.type && sourceData.type !== 'vertical-tab')) {
    return null;
  }

  const sourceGroup = sourceData.group;
  const targetGroup = targetAny.data?.group;
  if (sourceGroup && targetGroup && sourceGroup !== targetGroup) {
    return null;
  }

  const leaf = findLeafByTab(useTabsStore.getState().layout, tabId);
  if (!leaf) return null;

  const targetTabId = targetAny.data?.tabId;
  if (
    targetTabId &&
    targetTabId !== tabId &&
    targetAny.element instanceof Element
  ) {
    const baseIndex = leaf.tabIds.indexOf(targetTabId);
    if (baseIndex < 0) return null;
    const ghostTop = ghostTopEdge(sourceAny, operation);
    if (ghostTop == null) {
      return { tabId, index: undefined };
    }
    const rect = targetAny.element.getBoundingClientRect();
    const hoverCenter = rect.top + rect.height / 2;
    const placement = ghostTop < hoverCenter ? 'before' : 'after';
    const index = placement === 'before' ? baseIndex : baseIndex + 1;
    const len = leaf.tabIds.length;
    return {
      tabId,
      beforeTabId: targetTabId,
      placement,
      index: index >= len ? undefined : index,
    };
  }

  const ghostTop = ghostTopEdge(sourceAny, operation);
  if (ghostTop == null) return null;
  const index = insertIndexFromGhostTop(
    leaf.id,
    tabId,
    ghostTop,
    allowedTabIds,
  );
  const len = leaf.tabIds.length;
  return {
    tabId,
    index: index >= len ? undefined : index,
  };
}

export function applyVerticalTabDrop(drop: VerticalTabDrop) {
  const state = useTabsStore.getState();
  const leaf = findLeafByTab(state.layout, drop.tabId);
  if (!leaf) return;

  const fromIdx = leaf.tabIds.indexOf(drop.tabId);
  if (fromIdx < 0) return;

  if (drop.index === undefined) {
    if (fromIdx === leaf.tabIds.length - 1) return;
  } else if (drop.index === fromIdx || drop.index === fromIdx + 1) {
    return;
  }

  state.moveTab(drop.tabId, leaf.id, drop.index);
}
