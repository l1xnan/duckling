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
import { formatHotkey, HOTKEYS } from '@/hotkeys';
import { canDropTable, canFind, canMetadata } from '@/lib/capabilities';
import { quoteTableExpr } from '@/lib/sql/countByColumn';
import { buildSampleSql } from '@/lib/sql/sample';
import { SearchDialog } from '@/pages/sidebar/dialog/SearchDialog';
import { docsAtom } from '@/stores/app';
import { DBType, DialectConfig, getStoredDB, useDBListStore } from '@/stores/dbList';
import {
  EditorContextType,
  TableContextType,
  useTabsStore,
} from '@/stores/tabs';
import { NodeElementType } from '@/types';
import { Trans } from '@lingui/react/macro';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useSetAtom } from 'jotai';
import { RefreshCcw } from 'lucide-react';
import { nanoid } from 'nanoid';
import { PropsWithChildren } from 'react';

export function TableContextMenu({
  children,
  node,
  db,
}: PropsWithChildren<{ node: NodeElementType; db: DBType }>) {
  const updateTab = useTabsStore((state) => state.update);
  const append = useTabsStore((state) => state.append);
  const active = useTabsStore((state) => state.active);
  const updateDB = useDBListStore((state) => state.updateByConfig);
  const setDocs = useSetAtom(docsAtom);

  const alertDialog = useDialog();
  const searchDialog = useDialog();
  const allowDrop = canDropTable(db.dialect);
  const allowFind = canFind(db.dialect);
  const allowMetadata = canMetadata(db.dialect);

  const handleDropTable: React.MouseEventHandler<HTMLButtonElement> = async (e) => {
    e.stopPropagation();
    if (!allowDrop) return;
    const { connectionRef } = await import('@/lib/connectionRef');
    await dropTable(node.path, connectionRef(db.id));
  };

  const handleRefresh = async () => {
    const latest = getStoredDB(db.id);
    const config = latest?.config ?? db.config;
    if (config) {
      await updateDB(db.id, config);
    } else {
      // Refresh tree via connection id only (backend has credentials).
      await updateDB(db.id, { dialect: db.dialect } as DialectConfig);
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

  const handleSearch = async () => {
    if (!allowFind) return;
    searchDialog.trigger();
  };

  const handleCopy = async (e: Event) => {
    e.stopPropagation();
    await writeText(node.path);
  };

  const openSqlInEditor = (sql: string, title: string) => {
    const id = nanoid();
    const tab: EditorContextType = {
      id,
      dbId: db.id,
      tableId: node.path,
      type: 'editor',
      displayName: title,
    };
    setDocs((prev) => ({ ...prev, [id]: sql }));
    append(tab);
    active(id);
  };

  const handleSample = () => {
    const tableExpr = node.path || node.name;
    const sql = buildSampleSql({
      tableExpr,
      dialect: db.dialect,
      limit: 100,
    });
    openSqlInEditor(sql, `sample:${node.name}`);
  };

  const handleDescribe = () => {
    const d = (db.dialect || '').toLowerCase();
    const t = quoteTableExpr(node.path || node.name, d);
    let sql: string;
    if (d === 'mysql') {
      sql = `DESCRIBE ${t}`;
    } else if (d === 'postgres') {
      const parts = (node.path || node.name).split('.');
      const schema = parts.length > 1 ? parts[0] : 'public';
      const table = parts.length > 1 ? parts[1] : parts[0];
      sql =
        `SELECT column_name, data_type, is_nullable, column_default` +
        ` FROM information_schema.columns` +
        ` WHERE table_schema = '${schema.replaceAll("'", "''")}'` +
        ` AND table_name = '${table.replaceAll("'", "''")}'` +
        ` ORDER BY ordinal_position`;
    } else if (d === 'sqlite') {
      sql = `PRAGMA table_info(${t})`;
    } else if (d === 'duckdb') {
      sql = `DESCRIBE SELECT * FROM ${t} LIMIT 0`;
    } else if (d === 'clickhouse') {
      sql = `DESCRIBE TABLE ${t}`;
    } else {
      sql = `SELECT * FROM ${t} WHERE 1=0`;
    }
    openSqlInEditor(sql, `describe:${node.name}`);
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
          <ContextMenuItem
            onSelect={allowMetadata ? handleShowColumn : undefined}
            disabled={!allowMetadata}
          >
            <Trans>Show columns</Trans>
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleDescribe}>
            <Trans>Describe table</Trans>
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleSample}>
            <Trans>Sample 100 rows</Trans>
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
              <ContextMenuItem
                onSelect={handleSearch}
                disabled={!allowFind}
              >
                <Trans>Search</Trans>
              </ContextMenuItem>
              <ContextMenuItem onSelect={handkeOpenPath}>
                <Trans>Open Path</Trans>
              </ContextMenuItem>
            </>
          ) : null}

          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={allowDrop ? alertDialog.trigger : undefined}
            disabled={!allowDrop}
          >
            <Trans>Delete</Trans>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={handleCopy}>
            <Trans>Copy</Trans>
          </ContextMenuItem>
          <ContextMenuSeparator />

          <ContextMenuItem onSelect={handleRefresh} icon={RefreshCcw}>
            <Trans>Refresh</Trans>
            <ContextMenuShortcut>
              {formatHotkey(HOTKEYS['tree.refresh'].hotkey)}
            </ContextMenuShortcut>
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
