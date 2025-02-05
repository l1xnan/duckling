import { Tooltip } from '@/components/custom/tooltip';
import { cn } from '@/lib/utils';
import { DBType, NodeContextType, selectedNodeAtom } from '@/stores/dbList';
import { TableContextType, useTabsStore } from '@/stores/tabs';
import { NodeElementType } from '@/types';
import { Node3Type, convertId, convertTreeToMap, filterTree } from '@/utils';
import {
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
import { useAtom } from 'jotai';
import { ChevronRight } from 'lucide-react';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getTypeIcon } from './Icons';
import { ContextNode } from './TreeView2';

declare module '@headless-tree/core' {
  export interface ItemInstance<T> {
    onDoubleClick?: () => void;
    onSelect?: () => void;
  }
}

const Node = React.memo(
  ({
    tree,
    item,
    style,
  }: {
    tree: TreeInstance<Node3Type>;
    item: ItemInstance<Node3Type>;
    style: React.CSSProperties;
  }) => {
    const { onClick, ...props } = item.getProps();
    const rowAttrs: React.HTMLAttributes<any> = {
      role: 'treeitem',
      'aria-expanded': item.isExpanded(),
    };

    const node = item.getItemData();
    const { displayName, path, name, icon } = node?.data ?? {};
    const level = item.getItemMeta().level;

    return (
      <div style={style} className="w-full" ref={item.registerElement}>
        <ContextNode node={{ ...node, level }}>
          <div
            key={item.getId()}
            onDoubleClick={(e) => {
              onClick(e);
              item.onDoubleClick?.();
              item.onSelect?.();
            }}
            onClick={() => {
              tree.setSelectedItems([item.getItemMeta().itemId]);
              item.onSelect?.();
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
              'h-[22px]',
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
            <div className="flex items-center [&_svg]:size-4">
              {getTypeIcon(icon)}
            </div>

            <Tooltip title={path}>
              <div className="truncate font-mono">{displayName ?? name}</div>
            </Tooltip>
          </div>
        </ContextNode>
      </div>
    );
  },
);

const Inner = forwardRef<Virtualizer<HTMLDivElement, Element>, any>(
  ({ tree }: { tree: TreeInstance<Node3Type> }, ref) => {
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
        className="h-full overflow-x-hidden overflow-y-scroll scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-track-[#2b2d30] dark:scrollbar-thumb-[#4d4e51]"
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
              height: '22px',
              // paddingLeft: `${item.getItemMeta().level * 16}px`,
            } as React.CSSProperties;

            return (
              <Node key={item.getId()} tree={tree} item={item} style={style} />
            );
          })}
        </div>
      </div>
    );
  },
);

const ROOT = '__root__';

interface TreeViewProps {
  data: Record<string, Node3Type>;
  onSelectNode: (item: ItemInstance<Node3Type>) => void;
  onDoubleClickNode: (item: ItemInstance<Node3Type>) => void;
}

export const TreeView = forwardRef(
  (
    { data, onSelectNode, onDoubleClickNode }: TreeViewProps,
    ref: React.Ref<unknown> | undefined,
  ) => {
    const virtualizer = useRef<Virtualizer<HTMLDivElement, Element> | null>(
      null,
    );
    const [state, setState] = useState({});
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
        {
          createItemInstance: (prev, item) => ({
            ...prev,
            onDoubleClick: () => {
              onDoubleClickNode(item);
            },
            onSelect: () => {
              onSelectNode(item);
            },
          }),
        },
      ],
    });

    useEffect(() => {
      tree.rebuildTree();
    }, [data]);

    useImperativeHandle(ref, () => tree);

    return <Inner tree={tree} ref={virtualizer} />;
  },
);

export const TreeView3 = forwardRef(
  (
    {
      dbList,
      search,
    }: {
      dbList: DBType[];
      search?: string;
    },
    ref,
  ) => {
    const updateTab = useTabsStore((s) => s.update);
    const [, setSelectedNode] = useAtom(selectedNodeAtom);

    const treeData = useMemo(() => {
      const _treeData = {
        id: ROOT,
        children: dbList.map((db) => ({
          ...convertId(db.data, db.id, db.displayName),
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
        updateTab!(item);
      } else {
        console.warn('doubleClick node is null!');
      }
    };

    return (
      <TreeView
        data={treeData}
        ref={ref}
        onSelectNode={handleSelectNode}
        onDoubleClickNode={handleDoubleClickNode}
      />
    );
  },
);
