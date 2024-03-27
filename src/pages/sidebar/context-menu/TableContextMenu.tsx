import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { nanoid } from 'nanoid';
import { PropsWithChildren } from 'react';

import { dropTable } from '@/api';
import { ContextMenuItem } from '@/components/custom/context-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { searchAtom } from '@/pages/sidebar/SearchDialog';
import { DBType, DialectConfig } from '@/stores/dbList';
import { TableContextType, useTabsStore } from '@/stores/tabs';
import { TreeNode } from '@/types';
import { useAtom } from 'jotai';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export function TableContextMenu({
  children,
  node,
  db,
}: PropsWithChildren<{ node: TreeNode; db: DBType }>) {
  const updateTab = useTabsStore((state) => state.update);
  const [, setSearch] = useAtom(searchAtom);

  const handleDropTable: React.MouseEventHandler<HTMLDivElement> = async (
    e,
  ) => {
    e.stopPropagation();
    await dropTable(node.path, db.config as DialectConfig);
  };

  return (
    <AlertDialog
      onOpenChange={(s) => {
        console.log('alert', s);
      }}
    >
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent
          className="w-64"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
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
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={async (e) => {
                  e.stopPropagation();
                  console.log(node);
                  const item: TableContextType = {
                    id: nanoid(),
                    dbId: db.id,
                    tableId: node.path,
                    displayName: node?.name as string,
                    type: 'table',
                  };

                  setSearch({ open: true, item });
                }}
              >
                Search
              </ContextMenuItem>
            </>
          ) : null}

          <ContextMenuSeparator />

          <AlertDialogTrigger asChild>
            <ContextMenuItem>Delete</ContextMenuItem>
          </AlertDialogTrigger>

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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            Confirm deletion of table: <code>{node.path}</code>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild onClick={handleDropTable}>
            <Button variant="destructive">Yes</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
