import { Button } from '@/components/ui/button';
import { favoriteAtom, runsAtom } from '@/stores/app';
import { useTabsStore } from '@/stores/tabs';
import { useAtomValue } from 'jotai';
import { Code2Icon, SearchIcon, TableIcon } from 'lucide-react';
import React, { ReactNode } from 'react';

interface ItemLabelProps {
  icon?: ReactNode;
  content: ReactNode;
  onClick: () => void;
}

export const ItemLabel = React.forwardRef(
  ({ icon, content, onClick }: ItemLabelProps, ref) => {
    return (
      <Button
        variant="ghost"
        className="flex items-center justify-start p-0 pt-0.5 pb-0.5 text-sm h-6"
        ref={ref as React.Ref<HTMLButtonElement>}
        onClick={onClick}
      >
        <div className="mx-2 flex items-center h-full">{icon ?? ''}</div>
        <div className="truncate font-mono">{content}</div>
      </Button>
    );
  },
);

export function Favorite() {
  const items = useAtomValue(favoriteAtom);
  const updateTab = useTabsStore((state) => state.update);

  const handleClick = (item) => {
    updateTab(item);
  };
  return (
    <div className="grid h-full w-full">
      <div className="hidden border-r md:block">
        <div className="flex h-full flex-col gap-2">
          <div className="flex h-8 items-center border-b px-4">
            <a className="flex items-center gap-2 font-semibold">
              <span className="">Favorite</span>
            </a>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-1 text-sm">
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
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}

export function History() {
  const items = useAtomValue(runsAtom);
  const updateTab = useTabsStore((state) => state.update);

  const handleClick = (item) => {
    updateTab(item);
  };
  return (
    <div className="grid h-full w-full">
      <div className="hidden border-r md:block">
        <div className="flex h-full flex-col gap-2">
          <div className="flex h-8 items-center border-b px-4">
            <a className="flex items-center gap-2 font-semibold">
              <span className="">Favorite</span>
            </a>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-1 text-sm">
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
                    content={item.stmt}
                    icon={<Comp className="size-4 min-w-4 mr-1" />}
                    onClick={() => {
                      handleClick(item);
                    }}
                  />
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SqlCode() {
  return (
    <div className="grid size-full">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full flex-col gap-2">
          <div className="flex h-8 items-center border-b px-4">
            <a className="flex items-center gap-2 font-semibold">
              <span className="">Code</span>
            </a>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-1 text-sm font-medium"></nav>
          </div>
        </div>
      </div>
    </div>
  );
}
