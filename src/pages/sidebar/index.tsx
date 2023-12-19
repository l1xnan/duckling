import CodeIcon from '@mui/icons-material/Code';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import { Box, BoxProps, Divider, ListItemText } from '@mui/material';
import { styled } from '@mui/material/styles';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/primitives';
import { useEffect, useState } from 'react';

import { ContextMenu, ContextMenuItem } from '@/components/ContextMenu';
import DBConfig, { useDBConfigStore } from '@/pages/settings/DBSetting';
import DBTreeView from '@/pages/sidebar/DBTreeView';
import { SideToolbar } from '@/pages/sidebar/SideToolbar';
import { useDBListStore } from '@/stores/dbList';
import { TabContextType, useTabsStore } from '@/stores/tabs';

import Rename, { useRenameStore } from './Rename';

const TreeViewWrapper = styled(Box)<BoxProps>(() => ({
  width: '100%',
  maxHeight: 'calc(100vh - 64px)',
  height: 'calc(100vh - 64px)',
  overflow: 'auto',
  pr: 1,
  pb: 2,
}));

function Sidebar() {
  const [selectedTable, setSelectedTable] = useState<TabContextType | null>(
    null,
  );
  const dbList = useDBListStore((state) => state.dbList);
  const contextMenu = useDBListStore((state) => state.contextMenu);
  const setContextMenu = useDBListStore((state) => state.setContextMenu);
  const updateTab = useTabsStore((state) => state.update);
  const removeDB = useDBListStore((state) => state.remove);
  const onOpen = useDBConfigStore((state) => state.onOpen);
  const onOpenRename = useRenameStore((state) => state.onOpen);

  async function openUrl() {
    const path: string = await invoke('opened_urls');
    console.log(path);
  }

  useEffect(() => {
    openUrl();
    const unlisten = listen('open-directory', (e) => {
      console.log(e.payload);

      // TODO: open data file
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const handleClose = () => {
    setContextMenu(null);
  };

  return (
    <>
      <SideToolbar selectedTable={selectedTable} />
      <TreeViewWrapper>
        {dbList.map((db, _i) => (
          <DBTreeView
            key={db.id}
            db={db}
            selected={
              // mark selected table in current db
              selectedTable?.root == db.id ? selectedTable.tableName : null
            }
            onSelectedTable={setSelectedTable}
          />
        ))}
      </TreeViewWrapper>

      {/* ---------- modal/dialog ---------- */}

      {/* db context menu */}
      <ContextMenu
        open={contextMenu !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <ContextMenuItem
          onClick={() => {
            onOpen();
            handleClose();
          }}
          icon={<SettingsIcon />}
        >
          <ListItemText>Properties</ListItemText>
        </ContextMenuItem>
        <ContextMenuItem
          icon={<CodeIcon />}
          onClick={() => {
            onOpenRename();
            handleClose();
          }}
        >
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          icon={<CodeIcon />}
          onClick={() => {
            if (contextMenu?.context) {
              updateTab!(contextMenu?.context);
            }
            handleClose();
          }}
        >
          Query Editor
        </ContextMenuItem>
        <Divider />
        <ContextMenuItem
          icon={<DeleteIcon />}
          onClick={() => {
            if (contextMenu?.context?.root) {
              removeDB(contextMenu?.context?.root);
            }
            handleClose();
          }}
        >
          <ListItemText>Remove Data Source...</ListItemText>
        </ContextMenuItem>
      </ContextMenu>

      {/* db config */}
      <DBConfig />

      <Rename />
    </>
  );
}

export default Sidebar;
