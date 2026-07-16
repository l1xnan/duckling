import * as dialog from '@tauri-apps/plugin-dialog';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { ChevronRight, Code2Icon, FolderIcon, FolderPlus, RefreshCw, XIcon } from 'lucide-react';
import { Dispatch, ReactNode, SetStateAction, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { listSqlDir, readTextFile } from '@/api';
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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { docsAtom, sqlFoldersAtom } from '@/stores/app';
import { selectedNodeAtom, useDBListStore } from '@/stores/dbList';
import { EditorContextType, TabContextType, useTabsStore } from '@/stores/tabs';
import { TreeNode } from '@/types';

import { Container } from './Favorite';

function matchesQuery(text: string, query: string) {
  return !query || text.toLowerCase().includes(query);
}

/** Keep nodes that match query (by name) or have matching descendants. */
function filterSqlTree(node: TreeNode, query: string): TreeNode | null {
  if (!query) {
    return node;
  }
  const selfMatch = matchesQuery(node.name, query);
  const isDir = node.type === 'path' || (node.children?.length ?? 0) > 0;
  if (!isDir) {
    return selfMatch ? node : null;
  }
  const children = (node.children ?? [])
    .map((child) => filterSqlTree(child, query))
    .filter((child): child is TreeNode => child != null);
  if (selfMatch || children.length > 0) {
    return { ...node, children };
  }
  return null;
}

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
}: {
  rootPath: string;
  currentId?: string | null;
  onOpenFile: (node: TreeNode) => void;
  onRemove: () => void;
  search: string;
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

  const folderName =
    tree?.name || rootPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() || rootPath;
  const filtered = tree ? filterSqlTree(tree, search) : null;
  const forceExpand = !!search;
  const rootVisible =
    !search ||
    matchesQuery(folderName, search) ||
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
  const tabs = useTabsStore((state) => state.tabs);
  const currentId = useTabsStore((state) => state.currentId);
  const updateTab = useTabsStore((state) => state.update);
  const removeTab = useTabsStore((state) => state.remove);
  const dbList = useDBListStore((s) => s.dbList);
  const selectedNode = useAtomValue(selectedNodeAtom);
  const setDocs = useSetAtom(docsAtom);
  const [sqlFolders, setSqlFolders] = useAtom(sqlFoldersAtom);

  const [search, setSearch] = useState('');
  const [tempExpanded, setTempExpanded] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<EditorContextType | null>(
    null,
  );
  const deleteDialog = useDialog();
  const query = search.trim().toLowerCase();

  const scratchTabs = Object.values(tabs).filter(
    (tab): tab is EditorContextType =>
      tab.type === 'editor' && !(tab as EditorContextType).path,
  );
  const visibleScratchTabs = scratchTabs.filter((tab) =>
    matchesQuery(tab.displayName, query),
  );
  const showTempFolder =
    !query ||
    matchesQuery('Temporary Files', query) ||
    matchesQuery('temporary', query) ||
    visibleScratchTabs.length > 0;
  const tempOpen = !!query || tempExpanded;

  const resolveDbId = () => {
    if (selectedNode?.dbId) {
      return selectedNode.dbId;
    }
    return dbList[0]?.id ?? '';
  };

  const handleScratchClick = (item: TabContextType) => {
    updateTab(item);
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
    setPendingDelete(null);
    deleteDialog.dismiss();
  };

  const handleOpenFile = async (node: TreeNode) => {
    const path = node.path.replace(/\\/g, '/');
    const existing = tabs[path];
    if (existing) {
      updateTab(existing);
      return;
    }

    try {
      const content = await readTextFile(path);
      setDocs((prev) => ({ ...prev, [path]: content }));
      updateTab({
        id: path,
        dbId: resolveDbId(),
        displayName: node.name,
        type: 'editor',
        path,
      } satisfies EditorContextType);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleOpenFolder = async () => {
    const res = await dialog.open({ directory: true });
    if (!res || Array.isArray(res)) {
      return;
    }
    const path = res.replace(/\\/g, '/');
    setSqlFolders((prev) => (prev.includes(path) ? prev : [...prev, path]));
  };

  return (
    <Container
      title="Code"
      actions={
        <Button
          variant="ghost"
          size="icon"
          className="size-6 rounded-md"
          aria-label="Open SQL folder"
          onClick={() => {
            void handleOpenFolder();
          }}
        >
          <FolderPlus className="size-3.5" />
        </Button>
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
      {showTempFolder ? (
        <div>
          <TreeRow
            label="Temporary Files"
            expandable
            expanded={tempOpen}
            icon={<FolderIcon className="size-4" />}
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
                      aria-label="Delete temporary SQL"
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
          onOpenFile={(node) => {
            void handleOpenFile(node);
          }}
          onRemove={() => {
            setSqlFolders((prev) => prev.filter((p) => p !== folder));
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
            <AlertDialogTitle>Delete temporary SQL?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete temporary SQL “
              {pendingDelete?.displayName ?? ''}”. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDeleteScratch}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Container>
  );
}
