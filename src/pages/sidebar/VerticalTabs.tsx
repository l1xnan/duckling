import { XIcon } from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/shallow';

import { SearchInput } from '@/components/custom/search';
import { TabItemProps } from '@/components/PageTabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTabsStore } from '@/stores/tabs';

import { Container } from './Favorite';

export function Node({
  tab,
  onRemove,
  activate,
  onClick,
  visiable = true,
}: TabItemProps & {
  activate: boolean;
  visiable: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex items-center justify-between h-6 pr-1 min-w-0 hover:bg-accent',
        activate ? 'bg-accent' : null,
        visiable ? null : 'hidden',
      )}
      onClick={onClick}
    >
      <div className="px-1 truncate font-mono">{tab.displayName}</div>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'hidden group-hover:block rounded-lg size-5 ml-1',
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

export function VerticalTabs() {
  const { activateTab, removeTab, tabObj, ids, currentId } = useTabsStore(
    useShallow((s) => ({
      activateTab: s.active,
      removeTab: s.remove,
      tabObj: s.tabs,
      currentId: s.currentId,
      ids: s.ids,
    })),
  );

  const [search, setSearch] = useState('');

  return (
    <Container title="Tabs">
      <div className="bg-background/40">
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
        />
      </div>
      {ids.map((id, _i) => {
        const tab = tabObj?.[id];
        return (
          <Node
            key={id}
            tab={tab}
            visiable={tab.displayName
              .toLowerCase()
              .includes(search.toLowerCase())}
            onRemove={removeTab}
            activate={id == currentId}
            onClick={() => {
              activateTab(id);
            }}
          />
        );
      })}
    </Container>
  );
}
