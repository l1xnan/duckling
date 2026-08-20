import { DragDropProvider, DragOverlay, PointerSensor, useDragDropMonitor } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { useLingui } from '@lingui/react/macro';
import { AlignRight, ChevronRight, List, ListTree, XIcon } from 'lucide-react';
import { useCallback, useMemo, useState, type Ref } from 'react';
import { useShallow } from 'zustand/shallow';

import { getTypeIcon } from '@/components/custom/Icons';
import { SearchInput } from '@/components/custom/search';
import { Button } from '@/components/custom/ui/button';
import { TabItemContextMenu, TabItemProps, TabTypeIcon } from '@/components/PageTabs';
import {
  applyVerticalTabDrop,
  resetVerticalTabGrabOffsetY,
  resolveVerticalTabDrop,
  setVerticalTabGrabOffsetY,
} from '@/components/verticalTabDrag';
import { cn } from '@/lib/utils';
import { useDBListStore } from '@/stores/dbList';
import { TabContextType, useTabsStore } from '@/stores/tabs';

import { Container } from './Favorite';

type ViewMode = 'flat' | 'tree';

const FLAT_GROUP = 'vertical-tabs-flat';

function treeGroupId(dbId: string) {
  return `vertical-tabs-tree-${dbId}`;
}

function VerticalTabInsertLine({ side }: { side: 'before' | 'after' }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-primary',
        side === 'before' ? 'top-0' : 'bottom-0',
      )}
    />
  );
}

export function Node({
  tab,
  onRemove,
  onRemoveOther,
  activate,
  onClick,
  visiable = true,
  indent = 0,
  alignEnd = false,
  sortableRef,
  dimmed = false,
  showInsertBefore = false,
  showInsertAfter = false,
}: TabItemProps & {
  activate: boolean;
  visiable: boolean;
  onClick: () => void;
  onRemoveOther: (id: string) => void;
  indent?: number;
  alignEnd?: boolean;
  sortableRef?: Ref<HTMLDivElement>;
  dimmed?: boolean;
  showInsertBefore?: boolean;
  showInsertAfter?: boolean;
}) {
  return (
    <TabItemContextMenu
      tab={tab}
      onRemove={onRemove ?? (() => {})}
      onRemoveOther={onRemoveOther}
    >
      <div
        id={`vertical-tab-${tab.id}`}
        ref={sortableRef}
        className={cn(
          'group relative flex items-center justify-between h-6 pr-1 min-w-0 hover:bg-accent touch-none',
          activate ? 'bg-accent' : null,
          visiable ? null : 'hidden',
          dimmed && 'opacity-30',
        )}
        style={{ paddingLeft: indent ? `${indent}px` : undefined }}
        onClick={onClick}
      >
        {showInsertBefore ? <VerticalTabInsertLine side="before" /> : null}
        {showInsertAfter ? <VerticalTabInsertLine side="after" /> : null}
        <div className="flex shrink-0 items-center px-1">
          <TabTypeIcon type={tab.type} className="size-4" />
        </div>
        <div
          className={cn(
            'truncate font-mono min-w-0 flex-1',
            alignEnd && 'text-right [direction:rtl]',
          )}
        >
          {tab.displayName}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'hidden group-hover:block rounded-lg size-5 ml-1 shrink-0',
            'hover:bg-selection',
          )}
          onPointerDown={(e) => {
            e.stopPropagation();
            onRemove?.(tab.id);
          }}
        >
          <XIcon className="size-5 p-0.5" />
        </Button>
      </div>
    </TabItemContextMenu>
  );
}

type InsertIndicator = {
  tabId: string;
  placement: 'before' | 'after';
} | null;

function SortableVerticalTab({
  tab,
  index,
  group,
  insertIndicator,
  activeTabId,
  ...nodeProps
}: TabItemProps & {
  index: number;
  group: string;
  insertIndicator: InsertIndicator;
  activeTabId: string | null;
  activate: boolean;
  visiable: boolean;
  onClick: () => void;
  onRemoveOther: (id: string) => void;
  indent?: number;
  alignEnd?: boolean;
}) {
  const { ref, isDragging } = useSortable({
    id: tab.id,
    index,
    group,
    type: 'vertical-tab',
    accept: 'vertical-tab',
    data: {
      type: 'vertical-tab',
      tabId: tab.id,
      group,
    },
  });

  const isSource = activeTabId === tab.id;
  const showInsertBefore =
    insertIndicator?.tabId === tab.id &&
    insertIndicator.placement === 'before' &&
    !isSource;
  const showInsertAfter =
    insertIndicator?.tabId === tab.id &&
    insertIndicator.placement === 'after' &&
    !isSource;

  return (
    <Node
      {...nodeProps}
      tab={tab}
      sortableRef={ref}
      dimmed={isDragging || isSource}
      showInsertBefore={showInsertBefore}
      showInsertAfter={showInsertAfter}
    />
  );
}

function ConnectionGroup({
  label,
  dialect,
  dbId,
  tabs,
  search,
  expanded,
  onToggle,
  currentId,
  activateTab,
  removeTab,
  removeOtherTab,
  alignEnd = false,
  insertIndicator,
  activeTabId,
}: {
  label: string;
  dialect?: string;
  dbId: string;
  tabs: TabContextType[];
  search: string;
  expanded: boolean;
  onToggle: () => void;
  currentId?: string | null;
  activateTab: (id: string) => void;
  removeTab: (id: string) => void;
  removeOtherTab: (id: string) => void;
  alignEnd?: boolean;
  insertIndicator: InsertIndicator;
  activeTabId: string | null;
}) {
  const q = search.toLowerCase();
  const visibleTabs = tabs.filter((tab) =>
    tab.displayName?.toLowerCase()?.includes(q) ?? false,
  );
  const groupVisible =
    !q ||
    label.toLowerCase().includes(q) ||
    visibleTabs.length > 0;
  const groupId = treeGroupId(dbId);

  if (!groupVisible) {
    return null;
  }

  return (
    <div>
      <div
        className="group flex items-center gap-1 h-6 pr-1 min-w-0 cursor-pointer hover:bg-accent select-none"
        onClick={onToggle}
      >
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-foreground-muted transition-transform duration-200',
            expanded && 'rotate-90',
          )}
        />
        <div className="relative flex shrink-0 items-center [&_svg]:size-4">
          {getTypeIcon(dialect ?? 'root')}
        </div>
        <div className="min-w-0 flex-1 truncate font-mono text-sm">{label}</div>
        <span className="px-1 text-xs text-muted-foreground shrink-0">
          {visibleTabs.length}
        </span>
      </div>
      {expanded
        ? visibleTabs.map((tab, index) => (
            <SortableVerticalTab
              key={tab.id}
              tab={tab}
              index={index}
              group={groupId}
              insertIndicator={insertIndicator}
              activeTabId={activeTabId}
              indent={20}
              visiable
              alignEnd={alignEnd}
              onRemove={removeTab}
              onRemoveOther={removeOtherTab}
              activate={tab.id === currentId}
              onClick={() => {
                activateTab(tab.id);
              }}
            />
          ))
        : null}
    </div>
  );
}

function VerticalTabDragLayer() {
  const tabs = useTabsStore((s) => s.tabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  useDragDropMonitor({
    onDragStart(event) {
      const source = event.operation.source as {
        data?: { tabId?: string };
        id?: string | number;
        element?: Element | null;
      } | null;
      const tabId =
        source?.data?.tabId ||
        (typeof source?.id === 'string' ? source.id : null);
      setActiveTabId(tabId);
      const pos = event.operation.position as {
        current?: { y?: number };
        y?: number;
      };
      const y =
        typeof pos?.current?.y === 'number'
          ? pos.current.y
          : typeof pos?.y === 'number'
            ? pos.y
            : null;
      const el = source?.element;
      setVerticalTabGrabOffsetY(
        y != null && el instanceof Element
          ? y - el.getBoundingClientRect().top
          : 0,
      );
    },
    onDragEnd() {
      setActiveTabId(null);
      resetVerticalTabGrabOffsetY();
    },
  });

  const activeTab = activeTabId ? tabs[activeTabId] : undefined;

  return (
    <DragOverlay dropAnimation={null}>
      {activeTab ? (
        <div className="flex h-6 items-center gap-1 bg-background/80 px-2 text-xs shadow-md opacity-80 pointer-events-none">
          <TabTypeIcon type={activeTab.type} className="size-4" />
          <span className="max-w-48 truncate font-mono">{activeTab.displayName}</span>
        </div>
      ) : null}
    </DragOverlay>
  );
}

function VerticalTabList({
  viewMode,
  search,
  alignEnd,
  collapsed,
  setCollapsed,
  groups,
  flatVisibleIds,
  tabObj,
  currentId,
  activateTab,
  removeTab,
  removeOtherTab,
  allowedTabIdsByGroup,
}: {
  viewMode: ViewMode;
  search: string;
  alignEnd: boolean;
  collapsed: Record<string, boolean>;
  setCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  groups: {
    dbId: string;
    label: string;
    dialect?: string;
    tabs: TabContextType[];
  }[];
  flatVisibleIds: string[];
  tabObj: Record<string, TabContextType>;
  currentId?: string | null;
  activateTab: (id: string) => void;
  removeTab: (id: string) => void;
  removeOtherTab: (id: string) => void;
  allowedTabIdsByGroup: Map<string, Set<string>>;
}) {
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [insertIndicator, setInsertIndicator] = useState<InsertIndicator>(null);

  useDragDropMonitor({
    onDragStart(event) {
      const source = event.operation.source as {
        data?: { tabId?: string };
        id?: string | number;
      } | null;
      const tabId =
        source?.data?.tabId ||
        (typeof source?.id === 'string' ? source.id : null);
      setActiveTabId(tabId);
    },
    onDragOver(event) {
      const source = event.operation.source as {
        data?: { group?: string };
      } | null;
      const group = source?.data?.group;
      const allowedTabIds = group ? allowedTabIdsByGroup.get(group) : undefined;
      const drop = resolveVerticalTabDrop(
        event.operation.source,
        event.operation.target,
        event.operation as never,
        allowedTabIds,
      );
      if (!drop?.beforeTabId || !drop.placement) {
        setInsertIndicator(null);
        return;
      }
      setInsertIndicator({
        tabId: drop.beforeTabId,
        placement: drop.placement,
      });
    },
    onDragEnd() {
      setActiveTabId(null);
      setInsertIndicator(null);
    },
  });

  if (viewMode === 'flat') {
    return (
      <>
        {flatVisibleIds.map((id, index) => {
          const tab = tabObj?.[id];
          if (!tab) {
            return null;
          }
          return (
            <SortableVerticalTab
              key={id}
              tab={tab}
              index={index}
              group={FLAT_GROUP}
              insertIndicator={insertIndicator}
              activeTabId={activeTabId}
              alignEnd={alignEnd}
              visiable
              onRemove={removeTab}
              onRemoveOther={removeOtherTab}
              activate={id === currentId}
              onClick={() => {
                activateTab(id);
              }}
            />
          );
        })}
      </>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <ConnectionGroup
          key={group.dbId}
          dbId={group.dbId}
          label={group.label}
          dialect={group.dialect}
          tabs={group.tabs}
          search={search}
          expanded={!collapsed[group.dbId]}
          onToggle={() => {
            setCollapsed((prev) => ({
              ...prev,
              [group.dbId]: !prev[group.dbId],
            }));
          }}
          currentId={currentId}
          activateTab={activateTab}
          removeTab={removeTab}
          removeOtherTab={removeOtherTab}
          alignEnd={alignEnd}
          insertIndicator={insertIndicator}
          activeTabId={activeTabId}
        />
      ))}
    </>
  );
}

export function VerticalTabs() {
  const { t } = useLingui();
  const { activateTab, removeTab, removeOtherTab, tabObj, ids, currentId } = useTabsStore(
    useShallow((s) => ({
      activateTab: s.active,
      removeTab: s.remove,
      removeOtherTab: s.removeOther,
      tabObj: s.tabs,
      currentId: s.currentId,
      ids: s.ids,
    })),
  );
  const dbList = useDBListStore((s) => s.dbList);

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [alignEnd, setAlignEnd] = useState(false);

  const groups = useMemo(() => {
    const dbMap = new Map(dbList.map((db) => [db.id, db]));
    const byDb = new Map<
      string,
      { dbId: string; label: string; dialect?: string; tabs: TabContextType[] }
    >();

    for (const id of ids) {
      const tab = tabObj?.[id];
      if (!tab) {
        continue;
      }
      const dbId = tab.dbId || '__unknown__';
      let group = byDb.get(dbId);
      if (!group) {
        const db = dbMap.get(dbId);
        group = {
          dbId,
          label: db?.displayName ?? dbId,
          dialect: db?.dialect,
          tabs: [],
        };
        byDb.set(dbId, group);
      }
      group.tabs.push(tab);
    }

    return Array.from(byDb.values());
  }, [dbList, ids, tabObj]);

  const flatVisibleIds = useMemo(
    () =>
      ids.filter((id) => {
        const tab = tabObj?.[id];
        if (!tab) return false;
        return tab.displayName.toLowerCase().includes(search.toLowerCase());
      }),
    [ids, search, tabObj],
  );

  const allowedTabIdsByGroup = useMemo(() => {
    const map = new Map<string, Set<string>>();
    map.set(FLAT_GROUP, new Set(flatVisibleIds));
    for (const group of groups) {
      const visible = group.tabs
        .filter((tab) =>
          tab.displayName?.toLowerCase().includes(search.toLowerCase()),
        )
        .map((tab) => tab.id);
      map.set(treeGroupId(group.dbId), new Set(visible));
    }
    return map;
  }, [flatVisibleIds, groups, search]);

  const sensors = useMemo(() => [PointerSensor], []);

  const handleDragEnd = useCallback(
    (event: {
      canceled?: boolean;
      operation: { source: unknown; target: unknown; position?: unknown };
    }) => {
      if (event.canceled) return;

      const source = event.operation.source as {
        data?: { group?: string };
      } | null;
      const group = source?.data?.group;
      const allowedTabIds = group ? allowedTabIdsByGroup.get(group) : undefined;

      const drop = resolveVerticalTabDrop(
        event.operation.source,
        event.operation.target,
        event.operation as never,
        allowedTabIds,
      );
      if (!drop) return;
      queueMicrotask(() => {
        applyVerticalTabDrop(drop);
      });
    },
    [allowedTabIdsByGroup],
  );

  return (
    <Container
      title={t`Tabs`}
      actions={
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn('size-6 rounded-md', viewMode === 'flat' && 'bg-muted')}
            aria-label={t`Flat view`}
            onClick={() => setViewMode('flat')}
          >
            <List className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('size-6 rounded-md', viewMode === 'tree' && 'bg-muted')}
            aria-label={t`Tree view`}
            onClick={() => setViewMode('tree')}
          >
            <ListTree className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('size-6 rounded-md', alignEnd && 'bg-muted')}
            aria-label={t`Right align tab text`}
            onClick={() => setAlignEnd((v) => !v)}
          >
            <AlignRight className="size-3.5" />
          </Button>
        </div>
      }
    >
      <div className="bg-background/40">
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
        />
      </div>
      <DragDropProvider sensors={sensors as never} onDragEnd={handleDragEnd as never}>
        <VerticalTabDragLayer />
        <VerticalTabList
          viewMode={viewMode}
          search={search}
          alignEnd={alignEnd}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          groups={groups}
          flatVisibleIds={flatVisibleIds}
          tabObj={tabObj}
          currentId={currentId}
          activateTab={activateTab}
          removeTab={removeTab}
          removeOtherTab={removeOtherTab}
          allowedTabIdsByGroup={allowedTabIdsByGroup}
        />
      </DragDropProvider>
    </Container>
  );
}
