import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { PropsWithChildren } from 'react';

import { ContextMenuItem } from '@/components/custom/context-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { TreeNode } from '@/types';

export function SchemaContextMenu({
  children,
  node,
}: PropsWithChildren<{ node: TreeNode }>) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem
          onClick={async (e) => {
            console.log('show databases');
          }}
        >
          Show Database
        </ContextMenuItem>
        <ContextMenuItem
          onClick={async (e) => {
            e.stopPropagation();
            await writeText(node.path);
          }}
        >
          Copy
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
