import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { nanoid } from 'nanoid';
import { PropsWithChildren } from 'react';

import { ContextMenuItem } from '@/components/custom/context-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { DBType } from '@/stores/dbList';
import { SchemaContextType, useTabsStore } from '@/stores/tabs';
import { TreeNode } from '@/types';

export function SchemaContextMenu({
  children,
  node,
  db,
}: PropsWithChildren<{ node: TreeNode; db: DBType }>) {
  const updateTab = useTabsStore((state) => state.update);

  const handleShowDB = async (e: Event) => {
    e.stopPropagation();
    const item: SchemaContextType = {
      id: nanoid(),
      dbId: db.id,
      schema: node.path,
      displayName: node?.name as string,
      type: 'schema',
    };
    updateTab!(item);
  };

  const handleCopy = async (e: Event) => {
    e.stopPropagation();
    await writeText(node.path);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem onSelect={handleShowDB}>Show Database</ContextMenuItem>
        <ContextMenuSeparator />

        <ContextMenuItem onSelect={handleCopy}>Copy</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
