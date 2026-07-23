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
import {
  collectLeaves,
  moveTab as moveTabInLayout,
} from '@/stores/tabLayout';
import { useTabsStore, type TabContextType } from '@/stores/tabs';

export type ResolvedTabDrop = {
  tabId: string;
  toPaneId: string;
  /** Insert-before index; undefined means append. */
  index?: number;
};

type TabDropIndicator = { paneId: string; index: number } | null;

type TabDragSessionValue = {
  /** Live strip order per pane while dragging; null when idle. */
  draftOrders: Record<string, string[]> | null;
  indicator: TabDropIndicator;
  activeTabId: string | null;
};

const TabDragSessionContext = createContext<TabDragSessionValue>({
  draftOrders: null,
  indicator: null,
  activeTabId: null,
});

export function useTabDragSession() {
  return useContext(TabDragSessionContext);
}

/** Last resolved drop from dragOver (dragEnd target is often stale). */
let pendingDrop: ResolvedTabDrop | null = null;

export function takePendingDrop(): ResolvedTabDrop | null {
  const drop = pendingDrop;
  pendingDrop = null;
  return drop;
}

function pointerX(operation: {
  position?: { current?: { x?: number }; x?: number };
}): number | null {
  const pos = operation.position;
  if (!pos) return null;
  if (typeof pos.current?.x === 'number') return pos.current.x;
  if (typeof pos.x === 'number') return pos.x;
  return null;
}

function draggedTabLeft(source: {
  element?: Element | null;
}): number | null {
  const el = source.element;
  if (el instanceof Element) {
    return el.getBoundingClientRect().left;
  }
  return null;
}

/** Drop destination + insert-before index (pointer vs hover center). */
export function resolveTabDrop(
  source: unknown,
  target: unknown,
  operation?: { position?: { current?: { x?: number }; x?: number } },
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
    data?: { type?: string; tabId?: string; paneId?: string };
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

  if (targetData.type === 'pane-end' || targetData.type === 'pane') {
    return { tabId, toPaneId, index: undefined };
  }

  if (targetData.type === 'tab' && typeof targetAny.index === 'number') {
    const hoverEl = targetAny.element;
    const x =
      (operation ? pointerX(operation) : null) ?? draggedTabLeft(sourceAny);
    let index = targetAny.index;
    if (x != null && hoverEl instanceof Element) {
      const rect = hoverEl.getBoundingClientRect();
      const hoverCenter = rect.left + rect.width / 2;
      if (x >= hoverCenter) {
        index = targetAny.index + 1;
      }
    }
    return { tabId, toPaneId, index };
  }

  if (typeof sourceAny.sortable?.index === 'number') {
    return { tabId, toPaneId, index: sourceAny.sortable.index };
  }

  return { tabId, toPaneId, index: undefined };
}

function draftsFromLayout(
  layout: Parameters<typeof collectLeaves>[0],
): Record<string, string[]> {
  const drafts: Record<string, string[]> = {};
  for (const leaf of collectLeaves(layout)) {
    drafts[leaf.id] = [...leaf.tabIds];
  }
  return drafts;
}

function OverlayIcon({ type }: { type: string }) {
  if (type === 'search') return <SearchIcon className="size-4 shrink-0" />;
  if (type === 'editor') return <Code2Icon className="size-4 shrink-0" />;
  return <TableIcon className="size-4 shrink-0" />;
}

/**
 * Live strip draft + insert indicator + overlay while dragging.
 * Header order updates on dragOver; store commits on dragEnd (caller).
 */
export function TabDragSessionProvider({ children }: { children: ReactNode }) {
  const [draftOrders, setDraftOrders] = useState<Record<
    string,
    string[]
  > | null>(null);
  const [indicator, setIndicator] = useState<TabDropIndicator>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const tabs = useTabsStore((s) => s.tabs);

  useDragDropMonitor({
    onDragStart(event) {
      const source = event.operation.source as {
        data?: { type?: string; tabId?: string };
        id?: string | number;
      } | null;
      const data = source?.data ?? {};
      const tabId =
        data.tabId ||
        (typeof source?.id === 'string' ? source.id : undefined) ||
        null;
      setActiveTabId(tabId);
      pendingDrop = null;
      setIndicator(null);
      setDraftOrders(draftsFromLayout(useTabsStore.getState().layout));
    },
    onDragOver(event) {
      const { source, target } = event.operation;
      const drop = resolveTabDrop(source, target, event.operation as never);
      if (!drop) {
        setIndicator(null);
        return;
      }

      pendingDrop = drop;

      const layout = useTabsStore.getState().layout;
      setDraftOrders(
        draftsFromLayout(
          moveTabInLayout(layout, drop.tabId, drop.toPaneId, drop.index),
        ),
      );

      const targetData = ((target as { data?: { type?: string; tabId?: string } })
        ?.data ?? {}) as { type?: string; tabId?: string };
      const sourceData = ((source as { data?: { paneId?: string; tabId?: string } })
        ?.data ?? {}) as { paneId?: string; tabId?: string };
      if (
        targetData.type === 'tab' &&
        targetData.tabId &&
        sourceData.tabId === targetData.tabId &&
        sourceData.paneId === drop.toPaneId &&
        drop.index === (target as { index?: number }).index
      ) {
        setIndicator(null);
        return;
      }

      setIndicator({
        paneId: drop.toPaneId,
        index:
          drop.index === undefined
            ? Number.MAX_SAFE_INTEGER
            : drop.index,
      });
    },
    onDragEnd() {
      setActiveTabId(null);
      setDraftOrders(null);
      setIndicator(null);
    },
  });

  const activeTab: TabContextType | undefined = activeTabId
    ? tabs[activeTabId]
    : undefined;

  const value = useMemo(
    () => ({
      draftOrders,
      indicator,
      activeTabId,
    }),
    [activeTabId, draftOrders, indicator],
  );

  return (
    <TabDragSessionContext.Provider value={value}>
      {children}
      <DragOverlay dropAnimation={null}>
        {activeTab ? (
          <div
            className={cn(
              'flex h-8 items-center gap-1 rounded-md border bg-background px-2 text-xs shadow-md',
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
