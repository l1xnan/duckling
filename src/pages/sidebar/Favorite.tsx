import { Button } from '@/components/ui/button';
import { HistoryContextMenu } from '@/pages/sidebar/context-menu/HistoryContextMenu';
import { favoriteAtom, runsAtom } from '@/stores/app';
import { QueryContextType, TabContextType, useTabsStore } from '@/stores/tabs';
import { useAtomValue } from 'jotai';
import { Code2Icon, SearchIcon, TableIcon } from 'lucide-react';
import React, { PropsWithChildren, ReactNode } from 'react';

interface ItemLabelProps {
  icon?: ReactNode;
  content: ReactNode;
  onClick?: () => void;
}

export const ItemLabel = React.forwardRef(
  ({ icon, content, onClick }: ItemLabelProps, ref) => {
    return (
      <Button
        variant="ghost"
        className="w-full flex flex-row items-center justify-start p-0 pt-0.5 pb-0.5 text-sm h-6 min-w-0"
        ref={ref as React.Ref<HTMLButtonElement>}
        onClick={onClick}
      >
        {icon ? (
          <div className="ml-2 flex items-center h-full">{icon}</div>
        ) : null}
        <div className="ml-2 w-full truncate font-mono text-left">
          {content}
        </div>
      </Button>
    );
  },
);

export function Container({
  children,
  title,
}: PropsWithChildren<{ title: string }>) {
  return (
    <div className="grid h-full w-full">
      <div className="hidden border-r md:block">
        <div className="flex h-full flex-col gap-2">
          <div className="flex h-8 items-center border-b px-2">
            <a className="flex items-center gap-2 font-semibold">
              <span className="text-sm">{title}</span>
            </a>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-1 text-sm">{children}</nav>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Favorite() {
  const items = useAtomValue(favoriteAtom);
  const updateTab = useTabsStore((state) => state.update);

  const handleClick = (item: TabContextType) => {
    updateTab(item);
  };
  return (
    <Container title="Favorite">
      {items.map((item, i) => {
        const Comp =
          item.type == 'search'
            ? SearchIcon
            : item.type == 'editor'
              ? Code2Icon
              : TableIcon;
        return (
          <ItemLabel
            key={i}
            content={item.displayName}
            icon={<Comp className="size-4 min-w-4 mr-1" />}
            onClick={() => {
              handleClick(item);
            }}
          />
        );
      })}
    </Container>
  );
}

export function History() {
  const items = useAtomValue(runsAtom) as QueryContextType[];
  return (
    <Container title="History">
      {items.map((item, i) => {
        return (
          <HistoryContextMenu key={i} ctx={item}>
            <ItemLabel content={item.stmt} />
          </HistoryContextMenu>
        );
      })}
    </Container>
  );
}

export function SqlCode() {
  const tabs = useTabsStore((state) => state.tabs);
  const updateTab = useTabsStore((state) => state.update);

  const handleClick = (item: TabContextType) => {
    updateTab(item);
  };

  return (
    <Container title="Code">
      {Object.values(tabs)
        .filter((tab) => tab.type == 'editor')
        .map((item) => {
          return (
            <ItemLabel
              key={item.id}
              content={item.displayName}
              onClick={() => {
                handleClick(item);
              }}
            />
          );
        })}
    </Container>
  );
}
