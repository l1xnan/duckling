import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  BookmarkIcon,
  Code2Icon,
  DatabaseIcon,
  FileIcon,
  LayoutGridIcon,
  SearchIcon,
  ServerIcon,
  TableIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';

import { listSqlDir } from '@/api';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useRevealInSidebar } from '@/hooks/useRevealInSidebar';
import {
  buildOpenAnythingIndex,
  groupRankedOpenAnything,
  rankOpenAnything,
  type OpenAnythingKind,
} from '@/lib/openAnything';
import { executeOpenAnythingPayload } from '@/lib/openAnythingActions';
import { getCachedScratchDir, isScratchPath, resolveScratchDir } from '@/lib/scratchSql';
import { bookmarksAtom, docsAtom, favoriteAtom, sqlFoldersAtom } from '@/stores/app';
import { useDBListStore, useSelectedNodeStore } from '@/stores/dbList';
import { openAnythingOpenAtom } from '@/stores/openAnything';
import { EditorContextType, useTabsStore } from '@/stores/tabs';
import type { TreeNode } from '@/types';

const GROUP_LABEL: Record<OpenAnythingKind, ReturnType<typeof msg>> = {
  table: msg`Tables`,
  view: msg`Views`,
  file: msg`Files`,
  database: msg`Databases`,
  connection: msg`Connections`,
  favorite: msg`Favorites`,
  bookmark: msg`SQL bookmarks`,
  scratch: msg`Temporary queries`,
  sqlFile: msg`SQL files`,
};

function KindIcon({ kind }: { kind: OpenAnythingKind }) {
  const Icon =
    kind === 'table'
      ? TableIcon
      : kind === 'view'
        ? LayoutGridIcon
        : kind === 'file'
          ? FileIcon
          : kind === 'database'
            ? DatabaseIcon
            : kind === 'connection'
              ? ServerIcon
              : kind === 'favorite'
                ? SearchIcon
                : kind === 'bookmark'
                  ? BookmarkIcon
                  : Code2Icon;
  return <Icon className="size-4 shrink-0 opacity-70" />;
}

export function OpenAnythingDialog() {
  const { t } = useLingui();
  const [open, setOpen] = useAtom(openAnythingOpenAtom);
  const [query, setQuery] = useState('');
  const [sqlFileTrees, setSqlFileTrees] = useState<
    Array<{ rootPath: string; tree: TreeNode | null }>
  >([]);
  const [scratchDir, setScratchDir] = useState<string | null>(getCachedScratchDir());

  const dbList = useDBListStore((s) => s.dbList);
  const selectedNode = useSelectedNodeStore((s) => s.selectedNode);
  const favorites = useAtomValue(favoriteAtom);
  const bookmarks = useAtomValue(bookmarksAtom);
  const sqlFolders = useAtomValue(sqlFoldersAtom);
  const docs = useAtomValue(docsAtom);
  const setDocs = useSetAtom(docsAtom);
  const revealInSidebar = useRevealInSidebar();

  const [tabs, updateTab, append, active] = useTabsStore(
    useShallow((s) => [s.tabs, s.update, s.append, s.active]),
  );

  const scratchEditors = useMemo(
    () =>
      Object.values(tabs).filter(
        (tab): tab is EditorContextType =>
          tab.type === 'editor' &&
          (!(tab as EditorContextType).path ||
            isScratchPath((tab as EditorContextType).path, scratchDir)),
      ),
    [scratchDir, tabs],
  );

  const resolveDbId = useCallback(() => {
    if (selectedNode?.dbId) {
      return selectedNode.dbId;
    }
    return dbList[0]?.id ?? '';
  }, [dbList, selectedNode?.dbId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void resolveScratchDir().then(setScratchDir);
  }, [open]);

  useEffect(() => {
    if (!open || sqlFolders.length === 0) {
      setSqlFileTrees([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const trees = await Promise.all(
        sqlFolders.map(async (rootPath) => {
          try {
            const tree = await listSqlDir(rootPath);
            return { rootPath, tree };
          } catch {
            return { rootPath, tree: null };
          }
        }),
      );
      if (!cancelled) {
        setSqlFileTrees(trees);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, sqlFolders]);

  const allItems = useMemo(
    () =>
      buildOpenAnythingIndex({
        dbList,
        favorites,
        bookmarks,
        scratchEditors,
        sqlFileTrees,
        defaultDbId: resolveDbId(),
      }),
    [bookmarks, dbList, favorites, resolveDbId, scratchEditors, sqlFileTrees],
  );

  const ranked = useMemo(() => rankOpenAnything(allItems, query), [allItems, query]);
  const groups = useMemo(() => groupRankedOpenAnything(ranked), [ranked]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery('');
    }
  };

  const runItem = useCallback(
    (value: string) => {
      const item = allItems.find((i) => i.id === value);
      if (!item) {
        return;
      }
      void executeOpenAnythingPayload(item.payload, {
        tabs,
        updateTab,
        append,
        active,
        setDocs,
        docs,
        revealInSidebar,
        resolveDbId,
      });
      setOpen(false);
      setQuery('');
    },
    [
      active,
      allItems,
      append,
      docs,
      revealInSidebar,
      resolveDbId,
      setDocs,
      setOpen,
      tabs,
      updateTab,
    ],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t(msg`Open anything`)}
      description={t(msg`Search databases, tables, favorites, and SQL files`)}
      className="top-[14%] w-full max-w-[min(40rem,calc(100%-2rem))] sm:max-w-2xl"
    >
      <Command shouldFilter={false} className="min-h-0">
        <CommandInput
          placeholder={t(msg`Type to search…`)}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[min(32rem,55vh)]">
          <CommandEmpty>{t(msg`No results found.`)}</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group.kind} heading={t(GROUP_LABEL[group.kind])}>
              {group.items.map((item) => (
                <CommandItem key={item.id} value={item.id} onSelect={runItem}>
                  <KindIcon kind={item.kind} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">{item.name}</span>
                    {item.subtitle ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {item.subtitle}
                      </span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
