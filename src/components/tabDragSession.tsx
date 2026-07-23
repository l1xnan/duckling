import { DragOverlay, useDragDropMonitor } from '@dnd-kit/react';
import { Code2Icon, SearchIcon, TableIcon } from 'lucide-react';
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';
import { findLeaf, type PaneDropZone } from '@/stores/tabLayout';
import { useTabsStore, type TabContextType } from '@/stores/tabs';

export type ResolvedTabDrop = {
  tabId: string;
  toPaneId: string;
  /** Insert-before index; undefined means append. */
  index?: number;
  /** Body overlay zone — when set, use dropOnPane instead of moveTab. */
  bodyZone?: PaneDropZone;
};

type TabDropIndicator = { paneId: string; index: number } | null;

type TabDragSessionValue = {
  indicator: TabDropIndicator;
  activeTabId: string | null;
};

const TabDragSessionContext = createContext<TabDragSessionValue>({
  indicator: null,
  activeTabId: null,
});

export function useTabDragSession() {
  return useContext(TabDragSessionContext);
}

/** Shared with DragDropProvider.onDragEnd (stale end target workaround). */
let pendingDrop: ResolvedTabDrop | null = null;
/** pointerX - source.left at drag start → ghostLeft = pointerX - grabOffsetX */
let grabOffsetX = 0;

export function takePendingDrop(): ResolvedTabDrop | null {
  const drop = pendingDrop;
  pendingDrop = null;
  return drop;
}

type OpPos = {
  position?: {
    current?: { x?: number; y?: number };
    x?: number;
    y?: number;
  };
};

function pointerX(operation?: OpPos): number | null {
  const pos = operation?.position;
  if (!pos) return null;
  if (typeof pos.current?.x === 'number') return pos.current.x;
  if (typeof pos.x === 'number') return pos.x;
  return null;
}

function pointerY(operation?: OpPos): number | null {
  const pos = operation?.position;
  if (!pos) return null;
  if (typeof pos.current?.y === 'number') return pos.current.y;
  if (typeof pos.y === 'number') return pos.y;
  return null;
}

/** Virtual drag object left edge (DragOverlay). */
function ghostLeftEdge(
  source: { element?: Element | null },
  operation?: OpPos,
): number | null {
  const x = pointerX(operation);
  if (x != null) return x - grabOffsetX;
  if (source.element instanceof Element) {
    return source.element.getBoundingClientRect().left;
  }
  return null;
}

/**
 * Insert-before from ghost left vs each other tab's center (store order).
 * ghostLeft < center → before that tab; past all centers → append (len).
 */
function insertIndexFromGhostLeft(
  paneId: string,
  dragTabId: string,
  ghostLeft: number,
): number {
  const leaf = findLeaf(useTabsStore.getState().layout, paneId);
  const tabIds = leaf?.tabIds ?? [];
  const prefix = `tab-trigger-${paneId}-`;

  const others = tabIds
    .filter((id) => id !== dragTabId)
    .map((id) => {
      const el = document.getElementById(`${prefix}${id}`);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        storeIndex: tabIds.indexOf(id),
        center: rect.left + rect.width / 2,
      };
    })
    .filter((t): t is { storeIndex: number; center: number } => t != null)
    .sort((a, b) => a.center - b.center);

  for (const t of others) {
    if (ghostLeft < t.center) return t.storeIndex;
  }
  return tabIds.length;
}

function resolveBodyZone(
  el: Element | null | undefined,
  operation?: OpPos,
  fallback: PaneDropZone = 'center',
): PaneDropZone {
  const x = pointerX(operation);
  const y = pointerY(operation);
  if (x == null || y == null || !(el instanceof Element)) return fallback;
  const rect = el.getBoundingClientRect();
  const lx = x - rect.left;
  const ly = y - rect.top;
  const edgeX = rect.width * 0.2;
  const edgeY = rect.height * 0.2;
  if (lx < edgeX) return 'left';
  if (lx > rect.width - edgeX) return 'right';
  if (ly < edgeY) return 'up';
  if (ly > rect.height - edgeY) return 'down';
  return 'center';
}

/**
 * Drop destination. Tab strip rule:
 *   ghost LEFT EDGE vs hover tab CENTER → before / after.
 * Bar order is not mutated until dragEnd commits.
 */
export function resolveTabDrop(
  source: unknown,
  target: unknown,
  operation?: OpPos,
): ResolvedTabDrop | null {
  if (!source || !target) return null;

  const sourceAny = source as {
    id?: string | number;
    data?: { type?: string; tabId?: string; paneId?: string };
    sortable?: { index?: number; group?: string };
    group?: string | number;
    element?: Element | null;
  };
  const targetAny = target as {
    id?: string | number;
    data?: {
      type?: string;
      tabId?: string;
      paneId?: string;
      zone?: PaneDropZone;
    };
    index?: number;
    group?: string | number;
    element?: Element | null;
  };

  const sourceData = sourceAny.data ?? {};
  const tabId =
    sourceData.tabId ||
    (typeof sourceAny.id === 'string' ? sourceAny.id : undefined);
  if (!tabId || (sourceData.type && sourceData.type !== 'tab')) {
    return null;
  }

  const targetData = targetAny.data ?? {};
  const toPaneId =
    (typeof targetData.paneId === 'string' && targetData.paneId) ||
    (typeof targetAny.group === 'string' ? targetAny.group : undefined) ||
    (targetData.type === 'pane' && typeof targetAny.id === 'string'
      ? targetAny.id
      : undefined) ||
    (typeof sourceAny.sortable?.group === 'string'
      ? sourceAny.sortable.group
      : undefined) ||
    (typeof sourceAny.group === 'string' ? sourceAny.group : undefined);

  if (!toPaneId) return null;

  if (targetData.type === 'pane-start') {
    return { tabId, toPaneId, index: 0 };
  }
  if (targetData.type === 'pane-end') {
    return { tabId, toPaneId, index: undefined };
  }
  if (targetData.type === 'pane-body') {
    return {
      tabId,
      toPaneId,
      bodyZone: resolveBodyZone(
        targetAny.element,
        operation,
        targetData.zone ?? 'center',
      ),
    };
  }

  // pane bar, tab, or self: ghost left vs tab centers
  if (
    targetData.type === 'pane' ||
    (targetData.type === 'tab' && targetData.tabId)
  ) {
    const ghostLeft = ghostLeftEdge(sourceAny, operation);
    if (ghostLeft == null) return null;

    const leaf = findLeaf(useTabsStore.getState().layout, toPaneId);
    const len = leaf?.tabIds.length ?? 0;

    // Explicit hover tab (not self): compare ghost left to that tab's center.
    if (
      targetData.type === 'tab' &&
      targetData.tabId &&
      targetData.tabId !== tabId &&
      targetAny.element instanceof Element
    ) {
      const storeIndex = leaf?.tabIds.indexOf(targetData.tabId) ?? -1;
      const baseIndex =
        storeIndex >= 0
          ? storeIndex
          : typeof targetAny.index === 'number'
            ? targetAny.index
            : 0;
      const rect = targetAny.element.getBoundingClientRect();
      const hoverCenter = rect.left + rect.width / 2;
      const index = ghostLeft < hoverCenter ? baseIndex : baseIndex + 1;
      return {
        tabId,
        toPaneId,
        index: index >= len ? undefined : index,
      };
    }

    // Self / bare pane: scan all other tab centers.
    const index = insertIndexFromGhostLeft(toPaneId, tabId, ghostLeft);
    return {
      tabId,
      toPaneId,
      index: index >= len ? undefined : index,
    };
  }

  return null;
}

function OverlayIcon({ type }: { type: string }) {
  if (type === 'search') return <SearchIcon className="size-4 shrink-0" />;
  if (type === 'editor') return <Code2Icon className="size-4 shrink-0" />;
  return <TableIcon className="size-4 shrink-0" />;
}

/** Indicator + floating chip; bar order fixed until dragEnd. */
export function TabDragSessionProvider({ children }: { children: ReactNode }) {
  const [indicator, setIndicator] = useState<TabDropIndicator>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const tabs = useTabsStore((s) => s.tabs);

  useDragDropMonitor({
    onDragStart(event) {
      const source = event.operation.source as {
        data?: { type?: string; tabId?: string };
        id?: string | number;
        element?: Element | null;
      } | null;
      const data = source?.data ?? {};
      const tabId =
        data.tabId ||
        (typeof source?.id === 'string' ? source.id : undefined) ||
        null;
      setActiveTabId(tabId);
      pendingDrop = null;
      setIndicator(null);

      const x = pointerX(event.operation as OpPos);
      const el = source?.element;
      grabOffsetX =
        x != null && el instanceof Element
          ? x - el.getBoundingClientRect().left
          : 0;
    },
    onDragOver(event) {
      const { source, target } = event.operation;
      const drop = resolveTabDrop(source, target, event.operation as OpPos);
      if (!drop) {
        if (!target) {
          pendingDrop = null;
          setIndicator(null);
        }
        return;
      }

      pendingDrop = drop;
      if (drop.bodyZone) {
        setIndicator(null);
        return;
      }

      const insertAt =
        drop.index === undefined ? Number.MAX_SAFE_INTEGER : drop.index;
      setIndicator((prev) =>
        prev?.paneId === drop.toPaneId && prev.index === insertAt
          ? prev
          : { paneId: drop.toPaneId, index: insertAt },
      );
    },
    onDragEnd() {
      setActiveTabId(null);
      setIndicator(null);
      grabOffsetX = 0;
    },
  });

  const activeTab: TabContextType | undefined = activeTabId
    ? tabs[activeTabId]
    : undefined;

  const value = useMemo(
    () => ({ indicator, activeTabId }),
    [activeTabId, indicator],
  );

  return (
    <TabDragSessionContext.Provider value={value}>
      {children}
      <DragOverlay dropAnimation={null}>
        {activeTab ? (
          <div
            className={cn(
              'flex h-8 items-center gap-1 border-r bg-background/70 pl-3 pr-1.5 text-xs shadow-md opacity-60',
              'pointer-events-none',
            )}
          >
            <OverlayIcon type={activeTab.type} />
            <span className="max-w-40 truncate">{activeTab.displayName}</span>
          </div>
        ) : null}
      </DragOverlay>
    </TabDragSessionContext.Provider>
  );
}
