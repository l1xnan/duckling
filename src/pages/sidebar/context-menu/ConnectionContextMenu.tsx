import { Trans } from '@lingui/react/macro';
import { Code, FileDown, RefreshCcw, Settings } from 'lucide-react';
import { nanoid } from 'nanoid';
import React, { PropsWithChildren, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { ContextMenuItem } from '@/components/custom/context-menu';
import { useDialog } from '@/components/custom/use-dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ConfigDialog } from '@/pages/sidebar/dialog/ConfigDialog';
import { ConnectionTransferDialog } from '@/pages/sidebar/dialog/ConnectionTransferDialog';
import { RenameDialog } from '@/pages/sidebar/dialog/RenameDialog';
import { DBType, getStoredDB, useDBListStore } from '@/stores/dbList';
import { useTabsStore } from '@/stores/tabs';

export const ConnectionContextMenu = React.memo(function ConnectionContextMenu({
  children,
  db,
}: PropsWithChildren<{ db: DBType }>) {
  const updateTab = useTabsStore((state) => state.update);
  const removeDB = useDBListStore((state) => state.remove);
  const updateDB = useDBListStore((state) => state.updateByConfig);

  const dialog = useDialog();
  const configDialog = useDialog();
  const [exportOpen, setExportOpen] = useState(false);

  const handleEditor = () => {
    if (db) {
      const displayName = db?.displayName ?? '';
      updateTab!({
        id: nanoid(),
        dbId: db.id,
        displayName,
        type: 'editor',
      });
    }
  };

  const handleRemove = () => {
    removeDB(db.id);
  };
  const handleProperties = () => {
    configDialog.trigger();
  };

  const handleRefresh = async () => {
    const latest = getStoredDB(db.id);
    const config = latest?.config ?? db.config;
    if (config) {
      await updateDB(db.id, config);
    }
  };

  const handleRename = () => {
    dialog.trigger();
  };
  const [enabled, setEnabled] = useState(false);

  useHotkeys('f2', handleRename, { enabled });
  useHotkeys('f3', handleProperties, { enabled });
  useHotkeys('f4', handleEditor, { enabled });
  useHotkeys('f5', handleRefresh, { enabled });
  useHotkeys('delete', handleRemove, { enabled });

  return (
    <>
      <ContextMenu onOpenChange={setEnabled}>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <ContextMenuItem onSelect={handleProperties} icon={Settings}>
            <Trans>Properties</Trans>
            <ContextMenuShortcut>F3</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={handleEditor} icon={Code}>
            <Trans>SQL Editor</Trans>
            <ContextMenuShortcut>F4</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem inset onSelect={handleRename}>
            <Trans>Rename</Trans>
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleRefresh} icon={RefreshCcw}>
            <Trans>Refresh</Trans>
            <ContextMenuShortcut>F5</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setExportOpen(true)} icon={FileDown}>
            <Trans>Export Connection</Trans>
          </ContextMenuItem>
          <ContextMenuItem inset onSelect={handleRemove} tabIndex={-1}>
            <Trans>Delete</Trans>
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <RenameDialog {...dialog.props} ctx={db} />
      <ConfigDialog {...configDialog.props} ctx={db} />
      <ConnectionTransferDialog
        mode="export"
        open={exportOpen}
        onOpenChange={setExportOpen}
        only={db}
      />
    </>
  );
});
