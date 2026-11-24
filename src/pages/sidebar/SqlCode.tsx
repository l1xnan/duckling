import { Trans, useLingui } from '@lingui/react/macro';
import * as dialog from '@tauri-apps/plugin-dialog';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { ChevronRight, Code2Icon, FileSearch, FolderClock, FolderIcon, FolderPlus, RefreshCw, XIcon } from 'lucide-react';
import { Dispatch, ReactNode, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { listSqlDir, searchSqlContents } from '@/api';
import { openSqlWorkspaceFile } from '@/lib/openSqlWorkspaceFile';
import { getTypeIcon } from '@/components/custom/Icons';
import { SearchInput } from '@/components/custom/search';
import { useDialog } from '@/components/custom/use-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/custom/ui/button';
import { TooltipButton } from '@/components/custom/tooltip';
import { migrateScratchSqlFromDocs } from '@/lib/migrateScratchSql';
import {
  isScratchPath,
  readScratch,
  removeScratch,
} from '@/lib/scratchSql';
import {
  collectSqlFilePaths,
  filterSqlTree,
  normalizeSqlPath,
  textIncludesQuery,
} from '@/lib/sqlCodeSearch';
import { atomStore } from '@/stores';
import { docsAtom, sqlFoldersAtom } from '@/stores/app';
import { useDBListStore, useSelectedNodeStore } from '@/stores/dbList';
import { EditorContextType, TabContextType, useTabsStore } from '@/stores/tabs';
import { TreeNode } from '@/types';

import { Container } from './Favorite';

import { cn } from '@/lib/utils';

function TreeRow({
  label,
  icon,
  indent = 0,
  expanded,
  expandable,
  active,
  onClick,
  onToggle,
  trailing,
}: {
  label: string;
  icon?: ReactNode;
  indent?: number;
  expanded?: boolean;
  expandable?: boolean;
  active?: boolean;
  onClick?: () => void;
  onToggle?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-1 h-6 pr-1 min-w-0 cursor-pointer hover:bg-accent select-none',
        active && 'bg-accent',
      )}
      style={{ paddingLeft: indent || undefined }}
      onClick={onClick}
    >
      {expandable ? (
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-foreground-muted transition-transform duration-200',
            expanded && 'rotate-90',
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
        />
      ) : (
        <span className="size-4 shrink-0" />
      )}
      {icon ? (
        <div className="relative flex shrink-0 items-center [&_svg]:size-4">{icon}</div>
      ) : null}
      <div className="min-w-0 flex-1 truncate font-mono text-sm">{label}</div>
      {trailing}
    </div>
  );
}

function SqlFileTree({
  node,
  indent,
  collapsed,
  setCollapsed,
  currentId,
  onOpenFile,
  forceExpand,
}: {
  node: TreeNode;
  indent: number;
  collapsed: Record<string, boolean>;
  setCollapsed: Dispatch<SetStateAction<Record<string, boolean>>>;
  currentId?: string | null;
  onOpenFile: (node: TreeNode) => void;
  forceExpand?: boolean;
}) {
  const isDir = node.type === 'path' || (node.children?.length ?? 0) > 0;
  const expanded = forceExpand || !collapsed[node.path];

  if (isDir) {
    return (
      <div>
        <TreeRow
          label={node.name}
          indent={indent}
          expandable
          expanded={expanded}
          icon={getTypeIcon('path', expanded)}
          onClick={() => {
            if (forceExpand) {
              return;
            }
            setCollapsed((prev) => ({
              ...prev,
              [node.path]: !prev[node.path],
            }));
          }}
          onToggle={() => {
            if (forceExpand) {
              return;
            }
            setCollapsed((prev) => ({
              ...prev,
              [node.path]: !prev[node.path],
            }));
          }}
        />
        {expanded
          ? node.children?.map((child) => (
              <SqlFileTree
                key={child.path}
                node={child}
                indent={indent + 12}
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                currentId={currentId}
                onOpenFile={onOpenFile}
                forceExpand={forceExpand}
              />
            ))
          : null}
      </div>
    );
  }

  return (
    <TreeRow
      label={node.name}
      indent={indent}
      active={currentId === node.path}
      icon={<Code2Icon className="size-4" />}
      onClick={() => onOpenFile(node)}
    />
  );
}

function LocalSqlFolder({
  rootPath,
  currentId,
  onOpenFile,
  onRemove,
  search,
  contentHits,
  onTree,
}: {
  rootPath: string;
  currentId?: string | null;
  onOpenFile: (node: TreeNode) => void;
  onRemove: () => void;
  search: string;
  contentHits: ReadonlySet<string>;
  onTree: (rootPath: string, tree: TreeNode | null) => void;
}) {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await listSqlDir(rootPath);
      setTree(next);
    } catch (e) {
      toast.error(String(e));
      setTree(null);
    } finally {
      setLoading(false);
    }
  }, [rootPath]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onTree(rootPath, tree);
  }, [onTree, rootPath, tree]);

  const folderName =
    tree?.name || rootPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() || rootPath;
  const filtered = tree ? filterSqlTree(tree, search, contentHits) : null;
  const forceExpand = !!search;
  const rootVisible =
    !search ||
    textIncludesQuery(folderName, search) ||
    (filtered?.children?.length ?? 0) > 0;

  if (!rootVisible) {
    return null;
  }

  const expanded = forceExpand || !collapsed[rootPath];

  return (
    <div>
      <TreeRow
        label={folderName}
        expandable
        expanded={expanded}
        icon={<FolderIcon className="size-4" />}
        onClick={() => {
          if (forceExpand) {
            return;
          }
          setCollapsed((prev) => ({
            ...prev,
            [rootPath]: !prev[rootPath],
          }));
        }}
        onToggle={() => {
          if (forceExpand) {
            return;
          }
          setCollapsed((prev) => ({
            ...prev,
            [rootPath]: !prev[rootPath],
          }));
        }}
        trailing={
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-5 rounded-md"
              disabled={loading}
              onClick={(e) => {
                e.stopPropagation();
                void load();
              }}
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-5 rounded-md"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        }
      />
      {expanded && filtered
        ? filtered.children?.map((child) => (
            <SqlFileTree
              key={child.path}
              node={child}
              indent={12}
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              currentId={currentId}
              onOpenFile={onOpenFile}
              forceExpand={forceExpand}
            />
          ))
        : null}
    </div>
  );
}

export function SqlCode() {
  const { t } = useLingui();
  const tabs = useTabsStore((state) => state.tabs);
  const currentId = useTabsStore((state) => state.currentId);
  const updateTab = useTabsStore((state) => state.update);
  const removeTab = useTabsStore((state) => state.remove);
  const dbList = useDBListStore((s) => s.dbList);
  const selectedNode = useSelectedNodeStore((s) => s.selectedNode);
  const setDocs = useSetAtom(docsAtom);
  const docs = useAtomValue(docsAtom);
  const [sqlFolders, setSqlFolders] = useAtom(sqlFoldersAtom);
  const [folderTrees, setFolderTrees] = useState<Record<string, TreeNode | null>>({});
  const [contentHits, setContentHits] = useState<ReadonlySet<string>>(() => new Set());
  const contentRequest = useRef(0);
  const searchedQuery = useRef('');

  const [search, setSearch] = useState('');
  const [searchContent, setSearchContent] = useState(false);
  const [tempExpanded, setTempExpanded] = useState(true);
  const [scratchDir, setScratchDir] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EditorContextType | null>(
    null,
  );
  const deleteDialog = useDialog();
  const query = search.trim().toLowerCase();
  const tempLabel = t`Temporary Files`;

  // Migrate legacy localStorage docs → app_data/scratch/*.sql
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await migrateScratchSqlFromDocs();
        if (cancelled) {
          return;
        }
        setScratchDir(result.scratchDir);
        if (
          result.migratedTabIds.length ||
          result.migratedOrphanDocIds.length ||
          result.rehydratedDiskIds.length
        ) {
          console.info('scratch sql migration', result);
        }
      } catch (e) {
        console.warn('scratch sql migration failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scratchTabs = useMemo(
    () =>
      Object.values(tabs).filter(
        (tab): tab is EditorContextType =>
          tab.type === 'editor' &&
          (!(tab as EditorContextType).path ||
            isScratchPath((tab as EditorContextType).path, scratchDir)),
      ),
    [scratchDir, tabs],
  );
  const visibleScratchTabs = scratchTabs.filter(
    (tab) => textIncludesQuery(tab.displayName, query) || contentHits.has(tab.id),
  );
  const showTempFolder =
    !query ||
    textIncludesQuery(tempLabel, query) ||
    textIncludesQuery('temporary', query) ||
    textIncludesQuery('临时', query) ||
    visibleScratchTabs.length > 0;
  const tempOpen = !!query || tempExpanded;

  const handleTree = useCallback((rootPath: string, tree: TreeNode | null) => {
    setFolderTrees((prev) => (prev[rootPath] === tree ? prev : { ...prev, [rootPath]: tree }));
  }, []);

  useEffect(() => {
    const request = ++contentRequest.current;
    const queryChanged = searchedQuery.current !== query;
    searchedQuery.current = query;
    if (!query || !searchContent) {
      setContentHits(new Set());
      return;
    }
    if (queryChanged) {
      setContentHits(new Set());
    }
    const timer = setTimeout(() => {
      void (async () => {
        const hits = new Set<string>();
        const disk: string[] = [];
        const scratchByPath = new Map<string, string>();
        for (const tree of Object.values(folderTrees)) {
          if (!tree) continue;
          for (const path of collectSqlFilePaths(tree)) {
            const memory = docs[path];
            if (memory != null) {
              if (textIncludesQuery(memory, query)) hits.add(path);
            } else {
              disk.push(path);
            }
          }
        }
        for (const tab of scratchTabs) {
          const memory = docs[tab.id];
          if (memory != null) {
            if (textIncludesQuery(memory, query)) hits.add(tab.id);
          } else if (tab.path) {
            const path = normalizeSqlPath(tab.path);
            disk.push(path);
            scratchByPath.set(path, tab.id);
          }
        }
        try {
          if (disk.length > 0) {
            const matched = await searchSqlContents(disk, query);
            if (request !== contentRequest.current) return;
            for (const path of matched) {
              const key = normalizeSqlPath(path);
              hits.add(key);
              const scratchId = scratchByPath.get(key);
              if (scratchId) hits.add(scratchId);
            }
          }
        } catch (error) {
          if (request === contentRequest.current) {
            toast.error(String(error));
          }
        }
        if (request === contentRequest.current) {
          setContentHits(hits);
        }
      })();
    }, 200);
    return () => {
      clearTimeout(timer);
    };
  }, [docs, folderTrees, query, scratchTabs, searchContent]);

  const resolveDbId = () => {
    if (selectedNode?.dbId) {
      return selectedNode.dbId;
    }
    return dbList[0]?.id ?? '';
  };

  const handleScratchClick = (item: TabContextType) => {
    void (async () => {
      if (
        item.type === 'editor' &&
        isScratchPath((item as EditorContextType).path, scratchDir)
      ) {
        const docsSnap = atomStore.get(docsAtom) ?? {};
        if (docsSnap[item.id] == null) {
          const body = await readScratch(item.id);
          setDocs((prev) =>
            prev[item.id] != null ? prev : { ...prev, [item.id]: body },
          );
        }
      }
      updateTab(item);
    })();
  };

  const requestDeleteScratch = (item: EditorContextType) => {
    setPendingDelete(item);
    deleteDialog.trigger();
  };

  const confirmDeleteScratch = () => {
    if (!pendingDelete) {
      return;
    }
    const id = pendingDelete.id;
    removeTab(id, true);
    setDocs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    void removeScratch(id);
    setPendingDelete(null);
    deleteDialog.dismiss();
  };

  const handleOpenFile = async (node: TreeNode) => {
    await openSqlWorkspaceFile(node, {
      tabs,
      updateTab,
      setDocs,
      resolveDbId,
    });
  };

  const handleOpenFolder = async () => {
    const res = await dialog.open({ directory: true });
    if (!res || Array.isArray(res)) {
      return;
    }
    const path = res.replace(/\\/g, '/');
    setSqlFolders((prev) => (prev.includes(path) ? prev : [...prev, path]));
  };

  const pendingDisplayName = pendingDelete?.displayName ?? '';

  return (
    <Container
      title={t`Code`}
      actions={
        <Button
          variant="ghost"
          size="icon"
          className="size-6 rounded-md"
          aria-label={t`Open SQL folder`}
          onClick={() => {
            void handleOpenFolder();
          }}
        >
          <FolderPlus className="size-3.5" />
        </Button>
      }
    >
      <div className="flex items-center border-b bg-background/40">
        <SearchInput
          value={search}
          className="min-w-0 flex-1 border-b-0"
          onChange={(e) => {
            setSearch(e.target.value);
          }}
        />
        <TooltipButton
          active={searchContent}
          aria-pressed={searchContent}
          aria-label={
            searchContent ? t`Search file names only` : t`Search file contents`
          }
          tooltip={
            searchContent ? t`Search file names only` : t`Search file contents`
          }
          className="mr-1 shrink-0"
          onClick={() => {
            setSearchContent((value) => !value);
          }}
        >
          <FileSearch className="size-3.5" />
        </TooltipButton>
      </div>
      {showTempFolder ? (
        <div>
          <TreeRow
            label={tempLabel}
            expandable
            expanded={tempOpen}
            icon={<FolderClock  className="size-4" />}
            onClick={() => {
              if (!query) {
                setTempExpanded((v) => !v);
              }
            }}
            onToggle={() => {
              if (!query) {
                setTempExpanded((v) => !v);
              }
            }}
            trailing={
              <span className="px-1 text-xs text-muted-foreground shrink-0">
                {visibleScratchTabs.length}
              </span>
            }
          />
          {tempOpen
            ? visibleScratchTabs.map((item) => (
                <TreeRow
                  key={item.id}
                  label={item.displayName}
                  indent={12}
                  active={currentId === item.id}
                  icon={<Code2Icon className="size-4" />}
                  onClick={() => handleScratchClick(item)}
                  trailing={
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'size-5 rounded-md shrink-0 opacity-0 group-hover:opacity-100',
                        'hover:bg-selection',
                      )}
                      aria-label={t`Delete temporary SQL`}
                      onClick={(e) => {
                        e.stopPropagation();
                        requestDeleteScratch(item);
                      }}
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  }
                />
              ))
            : null}
        </div>
      ) : null}

      {sqlFolders.map((folder) => (
        <LocalSqlFolder
          key={folder}
          rootPath={folder}
          currentId={currentId}
          search={query}
          contentHits={contentHits}
          onTree={handleTree}
          onOpenFile={(node) => {
            void handleOpenFile(node);
          }}
          onRemove={() => {
            setSqlFolders((prev) => prev.filter((p) => p !== folder));
            setFolderTrees((prev) => {
              if (!(folder in prev)) return prev;
              const next = { ...prev };
              delete next[folder];
              return next;
            });
          }}
        />
      ))}

      <AlertDialog
        open={deleteDialog.props.open}
        onOpenChange={(open) => {
          deleteDialog.props.onOpenChange(open);
          if (!open) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Delete temporary SQL?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>
                This will permanently delete temporary SQL "{pendingDisplayName}".
                This action cannot be undone.
              </Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDeleteScratch}
            >
              <Trans>Delete</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Container>
  );
}
