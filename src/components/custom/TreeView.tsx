import {
  FeatureImplementation,
  ItemInstance,
  TreeInstance,
  expandAllFeature,
  hotkeysCoreFeature,
  searchFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { Virtualizer, useVirtualizer } from '@tanstack/react-virtual';
import { useLingui } from '@lingui/react/macro';
import { ChevronRight } from 'lucide-react';
import React, {
  PropsWithChildren,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import { DelayedTooltip } from '@/components/custom/tooltip';
import {
  nextFrame,
  resolveDbNodeTarget,
  revealNodeInTree,
} from '@/lib/revealInSidebar';
import { isBrowsablePathNode } from '@/lib/treeNode';
import { cn } from '@/lib/utils';
import { DB_TREE_ROOT, buildDatabaseTreeData } from '@/lib/dbTreeData';
import { ConnectionContextMenu } from '@/pages/sidebar/context-menu/ConnectionContextMenu';
import { SchemaContextMenu } from '@/pages/sidebar/context-menu/SchemaContextMenu';
import { TableContextMenu } from '@/pages/sidebar/context-menu/TableContextMenu';
import {
  DBType,
  NodeContextType,
  useDBListStore,
  useSelectedNodeStore,
} from '@/stores/dbList';
import { useRevealRequestStore } from '@/stores/reveal';
import { TableContextType, useTabsStore } from '@/stores/tabs';
import { NodeElementType } from '@/types';
import { Node3Type, convertTreeToMap, filterTree } from '@/utils';

import { getTypeIcon } from './Icons';

const TREE_ROW_HEIGHT = 22.5;

declare module '@headless-tree/core' {
  export interface ItemInstance<T> {
    onDoubleClick?: () => void;
    onSelect?: () => void;
  }
}

export function ContextNode({
  children,
  data,
  isRoot,
}: PropsWithChildren<{ data: NodeElementType; isRoot: boolean }>) {
  // Subscribe to the actual connection object so password/config updates re-render menus.
  const db = useDBListStore((s) => s.dbList.find((item) => item.id === data?.dbId));
  if (!db) {
    return children;
  }

  const isDummy = data.type === 'path' && !isBrowsablePathNode(data, db.dialect);

  return isRoot ? (
    <ConnectionContextMenu db={db}>{children}</ConnectionContextMenu>
  ) : data.type == 'database' ? (
    <SchemaContextMenu db={db} node={data}>
      {children}
    </SchemaContextMenu>
  ) : !isDummy ? (
    <TableContextMenu db={db} node={data}>
      {children}
    </TableContextMenu>
  ) : (
    children
  );
}

interface NodeProps {
  tree: TreeInstance<Node3Type>;
  item: ItemInstance<Node3Type>;
  style: React.CSSProperties;
}
const Node = ({ tree, item, style }: NodeProps) => {
  try {
    item.getItemData();
  } catch (error) {
    console.warn('error:', item.getId(), item.getItemMeta());
    console.warn(error);
    return null;
  }
  const { onClick, ...props } = item.getProps();
  const rowAttrs: React.HTMLAttributes<any> = {
    role: 'treeitem',
    'aria-expanded': item.isExpanded(),
  };
  const node = item.getItemData();
  const { displayName, path, name, icon } = node?.data ?? {};
  const level = item.getItemMeta().level;

  const isRoot = level === 0;
  return (
    <div style={style} className="w-full h-6" ref={item.registerElement}>
      <ContextNode data={node?.data} isRoot={isRoot}>
        <div
          key={item.getId()}
          onDoubleClick={(e) => {
            onClick(e);
            props.onDoubleClick?.();
            props.onSelect?.();
          }}
          onClick={() => {
            tree.setSelectedItems([item.getItemMeta().itemId]);
            props.onSelect?.();
          }}
          {...rowAttrs}
          {...props}
          style={{ paddingLeft: `${level * 16}px` }}
          className={cn(
            'group',
            'treeitem',
            'relative',
            'transition-colors',
            'flex items-center gap-1',
            'text-sm',
            'cursor-pointer',
            'select-none',
            'text-foreground',
            'hover:bg-accent',
            'aria-selected:bg-selection',
            'aria-selected:hover:bg-selection',
            'h-6',
          )}
        >
          {item.isFolder() ? (
            <ChevronRight
              onClick={(e) => {
                onClick?.(e);
                item.onSelect?.();
              }}
              className={cn(
                'text-foreground-muted',
                'transition-transform duration-200',
                'size-4 shrink-0',
                'group-aria-expanded:rotate-90',
              )}
            />
          ) : (
            <div className="size-4 shrink-0"></div>
          )}
          <div
            className={cn(
              'relative flex shrink-0 items-center [&_svg]:size-4',
              isRoot && node?.data?.loading ? 'animate-spin duration-2000' : '',
            )}
          >
            {getTypeIcon(icon)}
          </div>
          <div className="min-w-0 flex-1">
            <DelayedTooltip content={path}>
              <div className="truncate font-mono">{displayName ?? name}</div>
            </DelayedTooltip>
          </div>
        </div>
      </ContextNode>
    </div>
  );
};

const Inner = forwardRef<
  Virtualizer<HTMLDivElement, Element>,
  { tree: TreeInstance<Node3Type> }
>(({ tree }, ref) => {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: tree.getItems().length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => TREE_ROW_HEIGHT,
    overscan: 50,
  });

  useImperativeHandle(ref, () => virtualizer);
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-track-[#2b2d30] dark:scrollbar-thumb-[#4d4e51]"
    >
      <div
        ref={tree.registerElement}
        className="tree w-full relative"
        style={{ height: `${totalSize}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = tree.getItems()[virtualItem.index];
          const style = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualItem.start}px)`,
            // paddingLeft: `${item.getItemMeta().level * 16}px`,
          } as React.CSSProperties;

          return (
            <Node key={item.getId()} tree={tree} item={item} style={style} />
          );
        })}
      </div>
    </div>
  );
});

const ROOT = DB_TREE_ROOT;

interface TreeViewInnerProps {
  data: Record<string, Node3Type>;
  onSelectNode: (item: ItemInstance<Node3Type>) => void;
  onDoubleClickNode: (item: ItemInstance<Node3Type>) => void;
  onPrepareReveal?: () => void;
  revealActive?: boolean;
  ref?: React.Ref<unknown>;
}

export function TreeViewInner({
  data,
  onSelectNode,
  onDoubleClickNode,
  onPrepareReveal,
  revealActive = true,
  ref,
}: TreeViewInnerProps) {
  const { t } = useLingui();
  const revealRequest = useRevealRequestStore((s) => s.request);
  const consumeRequest = useRevealRequestStore((s) => s.consumeRequest);
  const virtualizer = useRef<Virtualizer<HTMLDivElement, Element> | null>(null);
  const treeInstanceRef = useRef<TreeInstance<Node3Type> | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const [state, setState] = useState({});

  const customClickBehavior: FeatureImplementation = {
    itemInstance: {
      getProps: ({ item, prev }) => ({
        ...prev?.(),
        onDoubleClick: (_e: MouseEvent) => {
          onDoubleClickNode(item);
          item.primaryAction();

          if (!item.isFolder()) {
            return;
          }

          if (item.isExpanded()) {
            item.collapse();
          } else {
            item.expand();
          }
        },
        onSelect: (_e: MouseEvent) => {
          onSelectNode(item);
        },
      }),
    },
  };

  const tree = useTree<Node3Type>({
    state,
    setState,
    rootItemId: ROOT,
    getItemName: (item) => item.getItemData()?.name,
    isItemFolder: (item) => !!item.getItemData()?.children,
    scrollToItem: (item) => {
      virtualizer.current?.scrollToIndex(item.getItemMeta().index, {
        align: 'center',
      });
    },
    dataLoader: {
      getItem: (id: string) => data[id],
      getChildren: (id: string) => data[id]?.children ?? [],
    },
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      searchFeature,
      expandAllFeature,
      customClickBehavior,
    ],
  });
  treeInstanceRef.current = tree;

  useEffect(() => {
    tree.rebuildTree();
  }, [data]);

  useEffect(() => {
    if (!revealRequest || !revealActive) {
      return;
    }
    const { tab, nonce } = revealRequest;
    let cancelled = false;
    void (async () => {
      let stage: 'resolve' | 'expand' = 'resolve';
      try {
        onPrepareReveal?.();
        await nextFrame();
        await nextFrame();
        const dbList = useDBListStore.getState().dbList;
        const target = resolveDbNodeTarget(tab, dbList);
        const treeInstance = treeInstanceRef.current;
        let treeData = dataRef.current;
        for (let attempt = 0; attempt < 8 && target && !treeData[target.nodeId]; attempt++) {
          await nextFrame();
          treeData = dataRef.current;
        }
        if (!target || !treeInstance || !treeData[target.nodeId]) {
          throw new Error('not found');
        }
        if (cancelled) {
          return;
        }
        stage = 'expand';
        const item = await revealNodeInTree(
          treeInstance,
          target.nodeId,
          treeData,
          (index) => {
            virtualizer.current?.scrollToIndex(index, { align: 'center' });
          },
        );
        const nodeData = item.getItemData()?.data;
        if (nodeData) {
          useSelectedNodeStore
            .getState()
            .setSelectedNode(nodeData as unknown as NodeContextType);
        }
      } catch {
        if (!cancelled) {
          toast.warning(
            stage === 'resolve'
              ? t`Cannot find this tab in the database explorer`
              : t`Failed to reveal this tab in the database explorer`,
          );
        }
      } finally {
        if (!cancelled) {
          consumeRequest(nonce);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consumeRequest, onPrepareReveal, revealActive, revealRequest, t]);

  useImperativeHandle(ref, () => tree);
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <Inner tree={tree} ref={virtualizer} />
    </div>
  );
}

interface TreeViewProps {
  dbList: DBType[];
  search?: string;
  onPrepareReveal?: () => void;
  revealActive?: boolean;
  ref?: React.Ref<unknown>;
}

export function TreeView({
  dbList,
  search,
  onPrepareReveal,
  revealActive = true,
  ref,
}: TreeViewProps) {
  const updateTab = useTabsStore((s) => s.update);
  const setSelectedNode = useSelectedNodeStore((s) => s.setSelectedNode);

  const treeData = useMemo(() => {
    const _treeData = buildDatabaseTreeData(dbList);

    return convertTreeToMap(
      filterTree(_treeData as NodeElementType, search) as NodeElementType,
    );
  }, [dbList, search]);

  const handleSelectNode = (item: ItemInstance<Node3Type>) => {
    const itemData = item.getItemData()?.data;
    setSelectedNode(itemData as unknown as NodeContextType);
  };

  // BUG: 闭包存在问题，只能获取上一次的外部变量值
  const handleDoubleClickNode = (item: ItemInstance<Node3Type>) => {
    const node = item.getItemData()?.data;

    if (!node) {
      console.warn('doubleClick data is null!');
      return;
    }

    const { dbId, path } = node;

    const nodeContext = {
      dbId,
      tableId: path as string,
    };

    const noDataTypes = ['path', 'database', 'root'];
    if (node && !noDataTypes.includes(node.type ?? '')) {
      const item: TableContextType = {
        ...nodeContext,
        id: node.id,
        dbId,
        displayName: node?.name as string,
        type: 'table',
      };

      console.log('update tab:', item);
      updateTab(item);
    } else {
      console.warn('doubleClick node is null!');
    }
  };
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <TreeViewInner
        data={treeData}
        ref={ref}
        revealActive={revealActive}
        onPrepareReveal={onPrepareReveal}
        onSelectNode={handleSelectNode}
        onDoubleClickNode={handleDoubleClickNode}
      />
    </div>
  );
}
