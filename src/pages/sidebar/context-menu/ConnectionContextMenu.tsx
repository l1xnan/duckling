import { useSetAtom } from 'jotai';
import { Code, RefreshCcw, Settings } from 'lucide-react';
import { PropsWithChildren } from 'react';

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
        dbId: db.id,
        displayName,
        id: db.id,
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
  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem onSelect={handleProperties}>
          <Settings size={14} className="mr-2.5" />
          Properties
          <ContextMenuShortcut>F3</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={handleEditor}>
          <Code size={14} className="mr-2.5" />
          SQL Editor
          <ContextMenuShortcut>F4</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem inset onSelect={() => setRenameContext(db)}>
          Rename
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleRefresh}>
          <RefreshCcw size={14} className="mr-2.5" />
          Refresh
          <ContextMenuShortcut>F5</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem inset onSelect={handleRemove}>
          Delete
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
