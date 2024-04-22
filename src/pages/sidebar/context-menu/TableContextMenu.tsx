import { dropTable, getDB } from '@/api';
import { ContextMenuItem } from '@/components/custom/context-menu';

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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { searchAtom } from '@/pages/sidebar/SearchDialog';
import { DBType, DialectConfig, useDBListStore } from '@/stores/dbList';
import { TableContextType, useTabsStore } from '@/stores/tabs';
import { TreeNode } from '@/types';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useAtom } from 'jotai';
import { RefreshCcw } from 'lucide-react';
import { nanoid } from 'nanoid';
import { PropsWithChildren } from 'react';

export function TableContextMenu({
  children,
  node,
  db,
}: PropsWithChildren<{ node: TreeNode; db: DBType }>) {
  const updateTab = useTabsStore((state) => state.update);
  const [, setSearch] = useAtom(searchAtom);
  const updateDB = useDBListStore((state) => state.update);

  const handleDropTable: React.MouseEventHandler<HTMLButtonElement> = async (
    e,
  ) => {
    e.stopPropagation();
    await dropTable(node.path, db.config as DialectConfig);
  };

  const handleRefresh = async () => {
    if (db.config) {
      const { data } = await getDB(db.config);
      updateDB(db.id, data);
    }
  };

  const handleShowTable = async (e: Event) => {
    e.stopPropagation();

    const dbId = db?.id;
    const tableId = node?.path;

    const nodeContext = { dbId, tableId };

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

  const handleShowParquet = async (e: Event) => {
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
  };

  const handleShowCsv = async (e: Event) => {
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
  };

  const handleShowColumn = async (e: Event) => {
    e.stopPropagation();
    const item: TableContextType = {
      id: nanoid(),
      dbId: db.id,
      tableId: node.path,
      displayName: node?.name as string,
      type: 'column',
    };
    updateTab!(item);
  };

  const handleSearch = async (e: Event) => {
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
  };

  const handleCopy = async (e: Event) => {
    e.stopPropagation();
    await writeText(node.path);
  };

  return (
    <AlertDialog>
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent
          className="w-64"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <ContextMenuItem onSelect={handleShowTable}>
            Show table
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleShowColumn}>
            Show columns
          </ContextMenuItem>
          {db.dialect == 'folder' ? (
            <>
              <ContextMenuItem onSelect={handleShowParquet}>
                Show *.parquet
              </ContextMenuItem>
              <ContextMenuItem onSelect={handleShowCsv}>
                Show *.csv
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={handleSearch}>Search</ContextMenuItem>
            </>
          ) : null}

          <ContextMenuSeparator />

          <AlertDialogTrigger asChild>
            <ContextMenuItem>Delete</ContextMenuItem>
          </AlertDialogTrigger>

          <ContextMenuSeparator />
          <ContextMenuItem onSelect={handleCopy}>Copy</ContextMenuItem>
          <ContextMenuSeparator />

          <ContextMenuItem onSelect={handleRefresh} icon={RefreshCcw}>
            Refresh
            <ContextMenuShortcut>F5</ContextMenuShortcut>
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
