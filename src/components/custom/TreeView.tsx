import { DelayedTooltip } from '@/components/custom/tooltip';
import { cn } from '@/lib/utils';
import {
  DBType,
  NodeContextType,
  dbMapAtom,
  selectedNodeAtom,
} from '@/stores/dbList';
import { TableContextType, useTabsStore } from '@/stores/tabs';
import { NodeElementType } from '@/types';
import { Node3Type, convertId, convertTreeToMap, filterTree } from '@/utils';
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
import { useAtom, useAtomValue } from 'jotai';
import { ChevronRight } from 'lucide-react';

import { ConnectionContextMenu } from '@/pages/sidebar/context-menu/ConnectionContextMenu';
import { SchemaContextMenu } from '@/pages/sidebar/context-menu/SchemaContextMenu';
import { TableContextMenu } from '@/pages/sidebar/context-menu/TableContextMenu';
import React, {
  PropsWithChildren,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getTypeIcon } from './Icons';

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
  const dbMap = useAtomValue(dbMapAtom);
  const db = dbMap.get(data?.dbId);
  if (!db) {
    return children;
  }

  const isDummy = data.type == 'path' && db.dialect != 'folder';

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
                  'size-4',
                  'group-aria-expanded:rotate-90',
                )}
              />
            ) : (
              <div className="size-4 min-w-4"></div>
            )}
            <div
              className={cn(
                'relative flex items-center [&_svg]:size-4',
              isRoot && node?.data?.loading ? 'animate-spin duration-2000' : '',
              )}
            >
              {getTypeIcon(icon)}
            </div>
            <DelayedTooltip content={path}>
              <div className="truncate font-mono">{displayName ?? name}</div>
            </DelayedTooltip>
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
    estimateSize: () => 22,
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

const ROOT = '__root__';

interface TreeViewInnerProps {
  data: Record<string, Node3Type>;
  onSelectNode: (item: ItemInstance<Node3Type>) => void;
  onDoubleClickNode: (item: ItemInstance<Node3Type>) => void;
  ref?: React.Ref<unknown>;
}

export function TreeViewInner({
  data,
  onSelectNode,
  onDoubleClickNode,
  ref,
}: TreeViewInnerProps) {
  const virtualizer = useRef<Virtualizer<HTMLDivElement, Element> | null>(null);
    const [state, setState] = useState({});

    const customClickBehavior: FeatureImplementation = {
      itemInstance: {
        getProps: ({ tree, item, prev }) => ({
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
        virtualizer.current?.scrollToIndex(item.getItemMeta().index);
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

    useEffect(() => {
      tree.rebuildTree();
    }, [data]);

    useImperativeHandle(ref, () => tree);
    return <Inner tree={tree} ref={virtualizer} />;
}

interface TreeViewProps {
      dbList: DBType[];
      search?: string;
  ref?: React.Ref<unknown>;
}

export function TreeView({ dbList, search, ref }: TreeViewProps) {
    const updateTab = useTabsStore((s) => s.update);
    const [, setSelectedNode] = useAtom(selectedNodeAtom);

    const treeData = useMemo(() => {
      const _treeData = {
        id: ROOT,
        children: dbList.map((db) => ({
          ...convertId(db.data, db.id, db.displayName),
          loading: db.loading,
          icon: db.dialect,
        })),
      };

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
    <TreeViewInner
        data={treeData}
        ref={ref}
        onSelectNode={handleSelectNode}
        onDoubleClickNode={handleDoubleClickNode}
      />
    );
}
