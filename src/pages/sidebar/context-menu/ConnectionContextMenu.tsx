import { useSetAtom } from 'jotai';
import { Code, RefreshCcw, Settings } from 'lucide-react';
import { nanoid } from 'nanoid';
import { PropsWithChildren, useState } from 'react';

import { getDB } from '@/api';
import { ContextMenuItem } from '@/components/custom/context-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DBType,
  configAtom,
  renameAtom,
  useDBListStore,
} from '@/stores/dbList';
import { useTabsStore } from '@/stores/tabs';
import { useHotkeys } from 'react-hotkeys-hook';

export function ConnectionContextMenu({
  children,
  db,
}: PropsWithChildren<{ db: DBType }>) {
  const setConfigContext = useSetAtom(configAtom);
  const setRenameContext = useSetAtom(renameAtom);

  const updateTab = useTabsStore((state) => state.update);
  const removeDB = useDBListStore((state) => state.remove);
  const updateDB = useDBListStore((state) => state.update);

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
    setConfigContext(db);
  };

  const handleRefresh = async () => {
    if (db.config) {
      const { data } = await getDB(db.config);
      updateDB(db.id, data);
    }
  };

  const handleRename = () => setRenameContext(db);
  const [enabled, setEnabled] = useState(false);

  useHotkeys('f2', handleRename, { enabled });
  useHotkeys('f3', handleProperties, { enabled });
  useHotkeys('f4', handleEditor, { enabled });
  useHotkeys('f5', handleRefresh, { enabled });
  useHotkeys('delete', handleRemove, { enabled });
  return (
    <ContextMenu
      onOpenChange={(open) => {
        setEnabled(open);
      }}
    >
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem onSelect={handleProperties} icon={Settings}>
          Properties
          <ContextMenuShortcut>F3</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={handleEditor} icon={Code}>
          SQL Editor
          <ContextMenuShortcut>F4</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem inset onSelect={handleRename}>
          Rename
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleRefresh} icon={RefreshCcw}>
          Refresh
          <ContextMenuShortcut>F5</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem inset onSelect={handleRemove} tabIndex={-1}>
          Delete
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
