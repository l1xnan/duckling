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
import { TableContextType, useTabsStore } from '@/stores/tabs';
import { TreeNode } from '@/types';

export function TableContextMenu({
  children,
  node,
  db,
}: PropsWithChildren<{ node: TreeNode; db: DBType }>) {
  const updateTab = useTabsStore((state) => state.update);

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem
          onClick={async (e) => {
            e.stopPropagation();
            console.log(node);
            const item: TableContextType = {
              id: nanoid(),
              dbId: db.id,
              tableId: node.path,
              displayName: node?.name as string,
              type: 'column',
            };
            updateTab!(item);
          }}
        >
          Show columns
        </ContextMenuItem>
        {db.dialect == 'folder' ? (
          <>
            <ContextMenuItem
              onClick={async (e) => {
                e.stopPropagation();
                console.log(node);
                const item: TableContextType = {
                  id: nanoid(),
                  dbId: db.id,
                  tableId: node.path,
                  tableName:
                    node.type == 'path'
                      ? `read_parquet('${node.path}/*.parquet', union_by_name=true, filename=true)`
                      : undefined,
                  displayName: node?.name as string,
                  type: 'table',
                };
                updateTab!(item);
              }}
            >
              Show *.parquet
            </ContextMenuItem>
            <ContextMenuItem
              onClick={async (e) => {
                e.stopPropagation();
                console.log(node);
                const item: TableContextType = {
                  id: nanoid(),
                  dbId: db.id,
                  tableId: node.path,
                  tableName:
                    node.type == 'path'
                      ? `read_csv('${node.path}/*.csv', union_by_name=true, filename=true)`
                      : undefined,
                  displayName: node?.name as string,
                  type: 'table',
                };
                updateTab!(item);
              }}
            >
              Show *.csv
            </ContextMenuItem>
          </>
        ) : null}

        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={async (e) => {
            e.stopPropagation();
          }}
        >
          Delete
        </ContextMenuItem>
        <ContextMenuSeparator />
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
