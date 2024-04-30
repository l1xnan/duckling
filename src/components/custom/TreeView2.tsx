import { Tooltip } from '@/components/custom/tooltip';
import { cn } from '@/lib/utils';

import { ConnectionContextMenu } from '@/pages/sidebar/context-menu/ConnectionContextMenu';
import { SchemaContextMenu } from '@/pages/sidebar/context-menu/SchemaContextMenu';
import { TableContextMenu } from '@/pages/sidebar/context-menu/TableContextMenu';
import { dbMapAtom, selectedNodeAtom, tablesAtom } from '@/stores/dbList';
import { TableContextType, useTabsStore } from '@/stores/tabs';
import { NodeElementType } from '@/types';
import { useAtomValue, useSetAtom } from 'jotai';
import { ChevronRight } from 'lucide-react';
import React, { PropsWithChildren } from 'react';
import { NodeRendererProps, RowRendererProps, Tree } from 'react-arborist';
import { TreeProps } from 'react-arborist/dist/module/types/tree-props';
import useResizeObserver from 'use-resize-observer';
import { getTypeIcon } from './Icons';

export const DefaultRow = React.memo(function DefaultRow<T>({
  node,
  attrs,
  innerRef,
  children,
}: RowRendererProps<T>) {
  return (
    <div
      {...attrs}
      ref={innerRef}
      // onFocus={(e) => e.preventDefault()}
      onClick={node.handleClick}
    >
      {children}
    </div>
  );
});

const Node = React.memo(function Node({
  node,
  style,
}: NodeRendererProps<NodeElementType>) {
  /* This node instance can do many things. See the API reference. */
  const { icon, name, path, displayName } = node.data;
  console.log('=========', name);
  return (
    <ContextNode node={node}>
      <div
        style={style}
        onDoubleClick={() => node.toggle()}
        className={cn(
          'relative',
          'transition-colors',
          'flex items-center gap-1',
          'text-sm',
          'cursor-pointer',
          'select-none',
          'text-foreground',
          'group-hover:bg-accent',
          'group-aria-selected:bg-selection',
          'h-[22px]',
        )}
      >
        {(node.children?.length ?? 0) > 0 ? (
          <ChevronRight
            onClick={() => node.toggle()}
            className={cn(
              'text-foreground-muted',
              'transition-transform duration-200',
              'size-4',
              !node.isClosed ? 'rotate-90' : '',
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
  );
});

export function ContextNode({
  children,
  node,
}: PropsWithChildren<Pick<NodeRendererProps<NodeElementType>, 'node'>>) {
  const dbMap = useAtomValue(dbMapAtom);
  const { data, level } = node;
  const db = dbMap.get(data?.dbId);
  if (!db) {
    return children;
  }

  const isDummy = data.type == 'path' && db.dialect != 'folder';

  return (
    <>
      {level === 0 ? (
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
      )}
    </>
  );
}

/* Customize Appearance */
export default function TreeDemo(props: TreeProps<NodeElementType>) {
  const { ref, width, height } = useResizeObserver();
  const updateTab = useTabsStore((state) => state.update);
  const dbTableMap = useAtomValue(tablesAtom);
  const setSelectedNode = useSetAtom(selectedNodeAtom);

  const handleSelect: TreeProps<NodeElementType>['onSelect'] = (nodes) => {
    console.log(nodes);
    const t = nodes?.[0]?.data;
    if (!t) {
      return;
    }
    const dbId = t?.dbId;
    const tableId = t?.path;

    const nodeContext = { dbId, tableId };
    setSelectedNode(nodeContext);

    const node = dbTableMap.get(dbId)?.get(tableId);
    const noDataTypes = ['path', 'database', 'root'];
    if (node && !noDataTypes.includes(node.type ?? '')) {
      const item: TableContextType = {
        ...nodeContext,
        id: `${dbId}:${tableId}`,
        dbId,
        displayName: node?.name as string,
        type: 'table',
      };

      console.log('item', item);
      updateTab!(item);
    }
  };

  return (
    <div className="size-full overflow-hidden" ref={ref}>
      <Tree
        openByDefault={false}
        indent={16}
        rowHeight={22}
        width={width}
        height={height}
        disableDrag={true}
        disableDrop={true}
        renderRow={DefaultRow}
        rowClassName="group"
        className="overflow-hidden !will-change-auto"
        onSelect={handleSelect}
        children={Node}
        {...props}
      />
    </div>
  );
}
