import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  bookmarksAtom,
  docsAtom,
  favoriteAtom,
  type SqlBookmark,
} from '@/stores/app';
import { TabContextType, useTabsStore } from '@/stores/tabs';
import { useLingui } from '@lingui/react/macro';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  BookmarkIcon,
  Code2Icon,
  SearchIcon,
  TableIcon,
  Trash2Icon,
} from 'lucide-react';
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
  const [bookmarks, setBookmarks] = useAtom(bookmarksAtom);
  const updateTab = useTabsStore((state) => state.update);
  const setDocs = useSetAtom(docsAtom);
  const append = useTabsStore((state) => state.append);
  const active = useTabsStore((state) => state.active);

  const handleClick = (item: TabContextType) => {
    updateTab(item);
  };

  const openBookmark = (b: SqlBookmark) => {
    const id = nanoid();
    setDocs((prev) => ({ ...prev, [id]: b.stmt }));
    append({
      id,
      dbId: b.dbId,
      type: 'editor',
      displayName: b.title || 'Bookmark',
    });
    active(id);
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
      {bookmarks.length > 0 ? (
        <div className="mt-2 border-t pt-1">
          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
            {t`SQL bookmarks`}
          </div>
          {bookmarks.map((b) => (
            <div key={b.id} className="group flex items-center pr-1">
              <div className="min-w-0 flex-1">
                <ItemLabel
                  content={b.title}
                  icon={<BookmarkIcon className="size-4 min-w-4 mr-1" />}
                  onClick={() => openBookmark(b)}
                />
              </div>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  setBookmarks((prev) => prev.filter((x) => x.id !== b.id))
                }
                aria-label={t`Delete bookmark`}
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </Container>
  );
}

export { SqlCode } from './SqlCode';
