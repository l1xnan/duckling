import { Tooltip } from '@/components/custom/tooltip';
import { cn } from '@/lib/utils';

import { ConnectionContextMenu } from '@/pages/sidebar/context-menu/ConnectionContextMenu';
import { SchemaContextMenu } from '@/pages/sidebar/context-menu/SchemaContextMenu';
import { TableContextMenu } from '@/pages/sidebar/context-menu/TableContextMenu';
import { dbMapAtom, selectedNodeAtom, tablesAtom } from '@/stores/dbList';
import { TableContextType, useTabsStore } from '@/stores/tabs';
import { useAtomValue, useSetAtom } from 'jotai';
import { ChevronRight } from 'lucide-react';
import { PropsWithChildren } from 'react';
import { NodeRendererProps, Tree } from 'react-arborist';
import { TreeProps } from 'react-arborist/dist/module/types/tree-props';
import useResizeObserver from 'use-resize-observer';
import { getTypeIcon } from '../TreeItem';

export const data = [
  { id: '1', name: 'Unread', type: '----' },
  { id: '2', name: 'Threads' },
  {
    id: '3',
    name: 'Chat Rooms',
    type: '----',
    children: [
      { id: 'c1', name: 'General' },
      { id: 'c2', name: 'Random' },
      { id: 'c3', name: 'Open Source Projects' },
    ],
  },
  {
    id: '4',
    name: 'Direct Messages',
    children: [
      { id: 'd1', name: 'Alice' },
      { id: 'd2', name: 'Bob' },
      { id: 'd3', name: 'Charlie' },
    ],
  },
];

function Node({ node, style }: NodeRendererProps<NodeType>) {
  /* This node instance can do many things. See the API reference. */
  const { icon, name, path } = node.data;
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
          node.isSelected ? '' : 'hover:bg-accent',
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
          <div className="truncate font-mono">{name}</div>
        </Tooltip>
      </div>
    </ContextNode>
  );
}

function ContextNode({
  children,
  node,
}: PropsWithChildren<Pick<NodeRendererProps<NodeType>, 'node'>>) {
  const dbMap = useAtomValue(dbMapAtom);
  const db = dbMap.get(node.data.dbId);
  if (!db) {
    return children;
  }

  const isDummy = node.data.type == 'path' && db.dialect != 'folder';

  return node.level === 0 ? (
    <ConnectionContextMenu db={db}>{children}</ConnectionContextMenu>
  ) : node.data.type == 'database' ? (
    <SchemaContextMenu db={db} node={node.data}>
      {children}
    </SchemaContextMenu>
  ) : !isDummy ? (
    <TableContextMenu db={db} node={node.data}>
      {children}
    </TableContextMenu>
  ) : (
    children
  );
}

interface NodeType {
  path: string;
  dbId: string;
  name: string;
  icon: string;
  type: string;
  children?: NodeType[];
}

/* Customize Appearance */
export default function TreeDemo(props: TreeProps<NodeType>) {
  const { ref, width, height } = useResizeObserver();
  const updateTab = useTabsStore((state) => state.update);
  const dbTableMap = useAtomValue(tablesAtom);
  const setSelectedNode = useSetAtom(selectedNodeAtom);

  const handleSelect: TreeProps<NodeType>['onSelect'] = (nodes) => {
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
        rowClassName="aria-selected:bg-selection"
        className="overflow-hidden !will-change-auto"
        onSelect={handleSelect}
        {...props}
      >
        {Node}
      </Tree>
    </div>
  );
}
