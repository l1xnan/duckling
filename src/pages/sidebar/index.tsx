import CodeIcon from '@mui/icons-material/Code';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import { Box, BoxProps, Divider, ListItemText } from '@mui/material';
import { styled } from '@mui/material/styles';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/primitives';
import { useAtom, useAtomValue } from 'jotai';
import { useEffect } from 'react';

import { ContextMenu, ContextMenuItem } from '@/components/ContextMenu';
import ConfigDialog from '@/pages/sidebar/ConfigDialog';
import RenameDialog from '@/pages/sidebar/RenameDialog';
import { SideToolbar, openCreateAtom } from '@/pages/sidebar/SideToolbar';
import {
  configAtom,
  contextMenuAtom,
  dbListAtom,
  dbMapAtom,
  renameAtom,
  useDBListStore,
} from '@/stores/dbList';
import { useTabsStore } from '@/stores/tabs';

import IndexPage from '../side';


const TreeViewWrapper = styled(Box)<BoxProps>(() => ({
  width: '100%',
  maxHeight: 'calc(100vh - 64px)',
  height: 'calc(100vh - 64px)',
  overflow: 'auto',
  pr: 1,
  pb: 2,
}));

function Sidebar() {
  const updateTab = useTabsStore((state) => state.update);
  const removeDB = useDBListStore((state) => state.remove);

  const dbList = useAtomValue(dbListAtom);
  const [contextMenu, setContextMenu] = useAtom(contextMenuAtom);
  const [renameContext, setRenameContext] = useAtom(renameAtom);
  const [configContext, setConfigContext] = useAtom(configAtom);

  const dbMap = useAtomValue(dbMapAtom);

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

  const openCreate = useAtomValue(openCreateAtom);
  console.log(openCreate);
  return (
    <>
      <SideToolbar />

      {/* <TreeViewWrapper>
        {dbList.map((db, _i) => {
          return <DBTreeView key={db.id} db={db} />;
        })}
      </TreeViewWrapper> */}
      <TreeViewWrapper>
        <IndexPage data={dbList.map((db) => db.data)} />
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
            setConfigContext(contextMenu?.context ?? null);
            handleClose();
          }}
          icon={<SettingsIcon />}
        >
          <ListItemText>Properties</ListItemText>
        </ContextMenuItem>
        <ContextMenuItem
          icon={<CodeIcon />}
          onClick={() => {
            setRenameContext(contextMenu?.context ?? null);
            handleClose();
          }}
        >
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          icon={<CodeIcon />}
          onClick={() => {
            const context = contextMenu?.context;
            if (context) {
              const dbId = context?.dbId ?? '';
              const db = dbMap.get(dbId);
              const displayName = db?.displayName ?? '';
              updateTab!({
                ...contextMenu.context,
                displayName,
                id: dbId,
                type: 'editor',
                children: [],
              });
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
            const dbId = contextMenu?.context?.dbId;
            if (dbId) {
              removeDB(dbId);
            }
            handleClose();
          }}
        >
          <ListItemText>Remove Data Source...</ListItemText>
        </ContextMenuItem>
      </ContextMenu>

      {/* rename */}
      {renameContext !== null ? <RenameDialog /> : null}
      {/* db config */}
      {configContext !== null ? <ConfigDialog /> : null}
      {/* {openCreate ? <DatabaseDialog /> : null} */}
    </>
  );
}

export default Sidebar;
