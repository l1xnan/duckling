import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HistoryContextMenu } from '@/pages/sidebar/context-menu/HistoryContextMenu';
import { docsAtom, favoriteAtom, runsAtom } from '@/stores/app';
import { QueryContextType, TabContextType, useTabsStore } from '@/stores/tabs';
import { useLingui } from '@lingui/react/macro';
import { useAtomValue, useSetAtom } from 'jotai';
import { Code2Icon, SearchIcon, TableIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
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
  actions,
}: PropsWithChildren<{ title: string; actions?: ReactNode }>) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex h-8 items-center justify-between border-b px-2 gap-2">
        <a className="flex items-center font-semibold min-w-0">
          <span className="text-sm truncate">{title}</span>
        </a>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="flex-1 min-h-0">
        <ScrollArea className="size-full">
          <div className="p-0 text-sm">{children}</div>
        </ScrollArea>
      </div>
    </div>
  );
}

export function Favorite() {
  const { t } = useLingui();
  const items = useAtomValue(favoriteAtom);
  const updateTab = useTabsStore((state) => state.update);

  const handleClick = (item: TabContextType) => {
    updateTab(item);
  };
  return (
    <Container title={t`Favorite`}>
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
  const { t } = useLingui();
  const items = useAtomValue(runsAtom) as QueryContextType[];
  const setDocs = useSetAtom(docsAtom);
  const append = useTabsStore((state) => state.append);
  const active = useTabsStore((state) => state.active);
  const currentId = useTabsStore((state) => state.currentId);
  const tabs = useTabsStore((state) => state.tabs);

  const handleOpen = (item: QueryContextType) => {
    const stmt = item.stmt ?? '';
    if (!stmt.trim()) return;
    const current = currentId ? tabs[currentId] : undefined;
    if (current?.type === 'editor') {
      setDocs((prev) => ({ ...prev, [current.id]: stmt }));
      active(current.id);
      return;
    }
    const id = nanoid();
    setDocs((prev) => ({ ...prev, [id]: stmt }));
    append({
      id,
      dbId: item.dbId,
      schema: item.schema,
      tableId: item.tableId,
      type: 'editor',
      displayName: stmt.slice(0, 40) || 'Query',
    });
    active(id);
  };

  return (
    <Container title={t`History`}>
      {items.map((item, i) => {
        return (
          <HistoryContextMenu key={i} ctx={item}>
            <ItemLabel
              content={item.stmt}
              onClick={() => handleOpen(item)}
            />
          </HistoryContextMenu>
        );
      })}
    </Container>
  );
}

export { SqlCode } from './SqlCode';
