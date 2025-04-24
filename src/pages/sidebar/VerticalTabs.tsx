import { TabItemProps } from '@/components/PageTabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTabsStore } from '@/stores/tabs';
import { XIcon } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { Container } from './Favorite';

export function Node({
  tab,
  onRemove,
  activate,
  onClick,
}: TabItemProps & { activate: boolean; onClick: () => void }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between h-6 min-w-0 hover:bg-accent',
        activate ? 'bg-accent' : null,
      )}
      onClick={onClick}
    >
      <div className="px-1 truncate font-mono">{tab.displayName}</div>
      <Button
        variant="ghost"
        size="icon"
        className={cn('rounded-lg size-5 visible ml-1', 'hover:bg-selection')}
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
  const { activateTab, removeTab, removeOtherTab, tabObj, ids, currentId } =
    useTabsStore(
      useShallow((s) => ({
        activateTab: s.active,
        removeTab: s.remove,
        removeOtherTab: s.removeOther,
        tabObj: s.tabs,
        currentId: s.currentId,
        ids: s.ids,
      })),
    );
  return (
    <Container title="Tabs">
      {ids.map((id, _i) => {
        return (
          <Node
            key={id}
            tab={tabObj?.[id]}
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
