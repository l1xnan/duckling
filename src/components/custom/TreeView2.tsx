import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { NodeRendererProps, Tree } from 'react-arborist';
import { SQL_ICON, TreeViewFolderIcon } from './TreeView1';

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

function Node({ node, style, dragHandle }: NodeRendererProps<any>) {
  /* This node instance can do many things. See the API reference. */
  console.log(node.isSelected);
  return (
    <div
      style={style}
      ref={dragHandle}
      onClick={() => node.toggle()}
      className={cn(
        node.isSelected ? 'bg-accent' : '',
        'relative',
        'transition-colors',
        'flex items-center gap-1',
        'text-sm',
        'cursor-pointer',
        'select-none',
        'text-foreground-light',
        'group',
        'h-[22px]',
        'hover:bg-accent',
      )}
    >
      {(node.children?.length ?? 0) > 0 ? (
        <>
          <ChevronRight
            className={cn(
              'text-foreground-muted',
              'group-aria-selected:text-foreground-light',
              'group-aria-expanded:text-foreground-light',
              'transition-transform duration-200',
              'group-aria-expanded:rotate-90',
              !node.isClosed ? 'rotate-90' : '',
              'size-4',
            )}
          />
          <TreeViewFolderIcon
            className={cn(
              'transition-colors',
              'text-foreground-muted',
              'group-aria-selected:text-foreground-light',
              'group-aria-expanded:text-foreground-light',
              'size-4',
            )}
            isOpen={!node.isClosed}
            size={16}
            strokeWidth={1.5}
          />
        </>
      ) : (
        <SQL_ICON
          className={cn(
            'transition-colors',
            'fill-foreground-muted',
            'fill-foreground',
            // 'group-aria-selected:fill-foreground',
            'size-4',
            'ml-3.5',
            // '-ml-0.5',
          )}
          size={16}
          strokeWidth={1.5}
        />
      )}
      <div className={cn('text-ellipsis')}>
        {node.data.name} {node.data.type}
      </div>
    </div>
  );
}

/* Customize Appearance */
export default function TreeDemo() {
  return (
    <Tree
      initialData={data}
      openByDefault={false}
      // width={600}
      height={1000}
      indent={24}
      rowHeight={22}
      paddingTop={30}
      paddingBottom={10}
      padding={25 /* sets both */}
    >
      {Node}
    </Tree>
  );
}
