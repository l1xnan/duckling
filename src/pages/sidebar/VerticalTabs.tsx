import { useLingui } from '@lingui/react/macro';
import { ChevronRight, List, ListTree, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';

import { getTypeIcon } from '@/components/custom/Icons';
import { SearchInput } from '@/components/custom/search';
import { TabItemProps, TabTypeIcon } from '@/components/PageTabs';
import { Button } from '@/components/custom/ui/button';
import { cn } from '@/lib/utils';
import { useDBListStore } from '@/stores/dbList';
import { TabContextType, useTabsStore } from '@/stores/tabs';

import { Container } from './Favorite';

type ViewMode = 'flat' | 'tree';

export function Node({
  tab,
  onRemove,
  activate,
  onClick,
  visiable = true,
  indent = 0,
}: TabItemProps & {
  activate: boolean;
  visiable: boolean;
  onClick: () => void;
  indent?: number;
}) {
  return (
    <div
      className={cn(
        'group flex items-center justify-between h-6 pr-1 min-w-0 hover:bg-accent',
        activate ? 'bg-accent' : null,
        visiable ? null : 'hidden',
      )}
      style={{ paddingLeft: indent ? `${indent}px` : undefined }}
      onClick={onClick}
    >
      <div className="flex shrink-0 items-center px-1">
        <TabTypeIcon type={tab.type} className="size-4" />
      </div>
      <div className="truncate font-mono min-w-0 flex-1">
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
  );
}

function ConnectionGroup({
  label,
  dialect,
  tabs,
  search,
  expanded,
  onToggle,
  currentId,
  activateTab,
  removeTab,
}: {
  label: string;
  dialect?: string;
  tabs: TabContextType[];
  search: string;
  expanded: boolean;
  onToggle: () => void;
  currentId?: string | null;
  activateTab: (id: string) => void;
  removeTab: (id: string) => void;
}) {
  const q = search.toLowerCase();
  const visibleTabs = tabs.filter((tab) =>
    tab.displayName.toLowerCase().includes(q),
  );
  const groupVisible =
    !q ||
    label.toLowerCase().includes(q) ||
    visibleTabs.length > 0;

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
        ? visibleTabs.map((tab) => (
            <Node
              key={tab.id}
              tab={tab}
              indent={20}
              visiable
              onRemove={removeTab}
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

export function VerticalTabs() {
  const { t } = useLingui();
  const { activateTab, removeTab, tabObj, ids, currentId } = useTabsStore(
    useShallow((s) => ({
      activateTab: s.active,
      removeTab: s.remove,
      tabObj: s.tabs,
      currentId: s.currentId,
      ids: s.ids,
    })),
  );
  const dbList = useDBListStore((s) => s.dbList);

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
      {viewMode === 'flat'
        ? ids.map((id) => {
            const tab = tabObj?.[id];
            if (!tab) {
              return null;
            }
            return (
              <Node
                key={id}
                tab={tab}
                visiable={tab.displayName
                  .toLowerCase()
                  .includes(search.toLowerCase())}
                onRemove={removeTab}
                activate={id === currentId}
                onClick={() => {
                  activateTab(id);
                }}
              />
            );
          })
        : groups.map((group) => (
            <ConnectionGroup
              key={group.dbId}
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
            />
          ))}
    </Container>
  );
}
