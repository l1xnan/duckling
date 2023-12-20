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
import DBTreeView from '@/pages/sidebar/DBTreeView';
import RenameDialog from '@/pages/sidebar/RenameDialog';
import { SideToolbar } from '@/pages/sidebar/SideToolbar';
import {
  configAtom,
  contextMenuAtom,
  dbAtomsAtom,
  renameAtom,
  useDBListStore,
} from '@/stores/dbList';
import { useTabsStore } from '@/stores/tabs';

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

  const [dbAtoms] = useAtom(dbAtomsAtom);
  const [contextMenu, setContextMenu] = useAtom(contextMenuAtom);
  const [renameContext, setRenameContext] = useAtom(renameAtom);
  const [configContext, setConfigContext] = useAtom(configAtom);

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
      <SideToolbar />
      <TreeViewWrapper>
        {dbAtoms.map((dbAtom, _i) => {
          const db = useAtomValue(dbAtom);

          return <DBTreeView key={db.id} db={db} />;
        })}
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
    </>
  );
}

export default Sidebar;
