import { dropTable, openPath } from '@/api';
import { ContextMenuItem } from '@/components/custom/context-menu';
import { useDialog } from '@/components/custom/use-dialog';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { SearchDialog } from '@/pages/sidebar/dialog/SearchDialog';
import { DBType, DialectConfig, useDBListStore } from '@/stores/dbList';
import { TableContextType, useTabsStore } from '@/stores/tabs';
import { NodeElementType } from '@/types';
import { Trans } from '@lingui/react/macro';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { RefreshCcw } from 'lucide-react';
import { nanoid } from 'nanoid';
import { PropsWithChildren } from 'react';

export function TableContextMenu({
  children,
  node,
  db,
}: PropsWithChildren<{ node: NodeElementType; db: DBType }>) {
  const updateTab = useTabsStore((state) => state.update);
  const updateDB = useDBListStore((state) => state.updateByConfig);

  const alertDialog = useDialog();
  const searchDialog = useDialog();

  const handleDropTable: React.MouseEventHandler<HTMLButtonElement> = async (e) => {
    e.stopPropagation();
    await dropTable(node.path, db.config as DialectConfig);
  };

  const handleRefresh = async () => {
    if (db.config) {
      updateDB(db.id, db.config);
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

  const handkeOpenPath = async (e: Event) => {
    e.stopPropagation();
    console.log('openPath', node.path);
    openPath(node.path);
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
    searchDialog.trigger();
  };

  const handleCopy = async (e: Event) => {
    e.stopPropagation();
    await writeText(node.path);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent
          className="w-64"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <ContextMenuItem onSelect={handleShowTable}>
            <Trans>Show table</Trans>
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleShowColumn}>
            <Trans>Show columns</Trans>
          </ContextMenuItem>
          {db.dialect == 'folder' ? (
            <>
              <ContextMenuItem onSelect={handleShowParquet}>
                <Trans>Show *.parquet</Trans>
              </ContextMenuItem>
              <ContextMenuItem onSelect={handleShowCsv}>
                <Trans>Show *.csv</Trans>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={handleSearch}>
                <Trans>Search</Trans>
              </ContextMenuItem>
              <ContextMenuItem onSelect={handkeOpenPath}>
                <Trans>Open Path</Trans>
              </ContextMenuItem>
            </>
          ) : null}

          <ContextMenuSeparator />
          <ContextMenuItem onSelect={alertDialog.trigger}>
            <Trans>Delete</Trans>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={handleCopy}>
            <Trans>Copy</Trans>
          </ContextMenuItem>
          <ContextMenuSeparator />

          <ContextMenuItem onSelect={handleRefresh} icon={RefreshCcw}>
            <Trans>Refresh</Trans>
            <ContextMenuShortcut>F5</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialog {...alertDialog.props}>
        <AlertDialogContent
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Are you absolutely sure?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>
                Confirm deletion of table: <code>{node.path}</code>
              </Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              render={
                <Button variant="destructive">
                  <Trans>Yes</Trans>
                </Button>
              }
              onClick={handleDropTable}
            ></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <SearchDialog {...searchDialog.props} ctx={node} />
    </>
  );
}
