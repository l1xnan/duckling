import { Trans } from '@lingui/react/macro';
import { Code, FileDown, RefreshCcw, Settings } from 'lucide-react';
import { nanoid } from 'nanoid';
import React, { PropsWithChildren, useEffect, useState } from 'react';

import { ContextMenuItem } from '@/components/custom/context-menu';
import { useDialog } from '@/components/custom/use-dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { formatHotkey, getHotkey } from '@/hotkeys';
import { ConfigDialog } from '@/pages/sidebar/dialog/ConfigDialog';
import { ConnectionTransferDialog } from '@/pages/sidebar/dialog/ConnectionTransferDialog';
import { RenameDialog } from '@/pages/sidebar/dialog/RenameDialog';
import {
  DBType,
  getStoredDB,
  useDBListStore,
  useSelectedNodeStore,
  type NodeContextType,
} from '@/stores/dbList';
import { useTabsStore } from '@/stores/tabs';

type TreeHotkeyDetail = {
  action: string;
  node: NodeContextType | null;
};

export const ConnectionContextMenu = React.memo(function ConnectionContextMenu({
  children,
  db,
}: PropsWithChildren<{ db: DBType }>) {
  const updateTab = useTabsStore((state) => state.update);
  const removeDB = useDBListStore((state) => state.remove);
  const updateDB = useDBListStore((state) => state.updateByConfig);
  const selectedNode = useSelectedNodeStore((s) => s.selectedNode);

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

  // Respond to global tree hotkeys when this connection is selected.
  useEffect(() => {
    const onTreeHotkey = (e: Event) => {
      const detail = (e as CustomEvent<TreeHotkeyDetail>).detail;
      if (!detail?.node || detail.node.dbId !== db.id) return;
      if (detail.action === 'rename') handleRename();
      else if (detail.action === 'properties') handleProperties();
      else if (detail.action === 'delete') handleRemove();
    };
    window.addEventListener('duckling:tree-hotkey', onTreeHotkey);
    return () => {
      window.removeEventListener('duckling:tree-hotkey', onTreeHotkey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.id, selectedNode?.dbId]);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <ContextMenuItem onSelect={handleProperties} icon={Settings}>
            <Trans>Properties</Trans>
            <ContextMenuShortcut>
              {formatHotkey(getHotkey('connection.properties'))}
            </ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={handleEditor} icon={Code}>
            <Trans>SQL Editor</Trans>
            <ContextMenuShortcut>
              {formatHotkey(getHotkey('connection.editor'))}
            </ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem inset onSelect={handleRename}>
            <Trans>Rename</Trans>
            <ContextMenuShortcut>
              {formatHotkey(getHotkey('connection.rename'))}
            </ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleRefresh} icon={RefreshCcw}>
            <Trans>Refresh</Trans>
            <ContextMenuShortcut>
              {formatHotkey(getHotkey('tree.refresh'))}
            </ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setExportOpen(true)} icon={FileDown}>
            <Trans>Export Connection</Trans>
          </ContextMenuItem>
          <ContextMenuItem inset onSelect={handleRemove} tabIndex={-1}>
            <Trans>Delete</Trans>
            <ContextMenuShortcut>
              {formatHotkey(getHotkey('tree.delete'))}
            </ContextMenuShortcut>
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
