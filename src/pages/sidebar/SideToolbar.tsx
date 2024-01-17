import RemoveIcon from '@mui/icons-material/Remove';
import { Stack, Typography } from '@mui/material';
import {
  IconDatabaseCog,
  IconDatabasePlus,
  IconFolderPlus,
  IconRefresh,
} from '@tabler/icons-react';
import * as dialog from '@tauri-apps/plugin-dialog';
import { atom, useAtomValue, useSetAtom } from 'jotai';

import { getDB } from '@/api';
import { MuiIconButton } from '@/components/MuiIconButton';
import ToggleColorMode from '@/components/ToggleColorMode';
import { ToolbarBox } from '@/components/Toolbar';
import { DatabaseDialog } from '@/components/custom/DatabaseDialog';
import Setting from '@/pages/settings/AppSetting';
import {
  DialectType,
  configAtom,
  selectedNodeAtom,
  useDBListStore,
} from '@/stores/dbList';

export const openCreateAtom = atom(false);

export function SideToolbar() {
  const dbList = useDBListStore((state) => state.dbList);
  const appendDB = useDBListStore((state) => state.append);
  const removeDB = useDBListStore((state) => state.remove);
  const updateDB = useDBListStore((state) => state.update);

  const setConfigContext = useSetAtom(configAtom);

  async function handleGetDB(url: string, dialect: DialectType) {
    const data = await getDB({ url, dialect });
    appendDB(data);
  }
  const setOpen = useSetAtom(openCreateAtom);

  const selectedNode = useAtomValue(selectedNodeAtom);

  const handleCreateOpen = () => {
    setOpen(true);
  };
  const handleOpen = () => {
    if (selectedNode) {
      setConfigContext({
        dbId: selectedNode.dbId,
        tableId: selectedNode.tableId,
      });
    }
  };

  async function handleRemoveDB() {
    if (selectedNode) {
      removeDB(selectedNode.dbId);
    }
  }
  async function handleAppendDB() {
    const res = await dialog.open({
      directory: false,
      filters: [
        {
          name: 'Data File',
          extensions: ['duckdb', 'parquet', 'csv'],
        },
      ],
    });
    if (!res) {
      return;
    }
    if (res.path.endsWith('.duckdb')) {
      handleGetDB(res.path, 'duckdb');
    } else {
      handleGetDB(res.path, 'file');
    }
  }

  async function handleAppendFolder() {
    const res = await dialog.open({
      directory: true,
    });
    if (res) {
      handleGetDB(res, 'folder');
    }
  }

  async function handleRefresh() {
    if (selectedNode) {
      const root = selectedNode.dbId;

      dbList.forEach(async (db) => {
        if (db.id == root) {
          const { data } = await getDB({
            url: db.data.path,
            dialect: db.dialect,
          });
          updateDB(root, data);
        }
      });
    }
  }

  const isRoot = selectedNode
    ? dbList.map((item) => item.data.path).includes(selectedNode?.tableId)
    : false;

  return (
    <>
      <ToolbarBox>
        <Typography fontWeight={800}>Database Explorer</Typography>
        <Stack direction="row">
          <ToggleColorMode />
          <Setting />
        </Stack>
      </ToolbarBox>
      <ToolbarBox>
        <Stack
          direction="row"
          sx={{
            marginLeft: -1,
          }}
        >
          <MuiIconButton onClick={handleAppendFolder}>
            <IconFolderPlus />
          </MuiIconButton>
          <MuiIconButton onClick={handleCreateOpen}>
            <IconDatabasePlus />
          </MuiIconButton>
          <MuiIconButton disabled={!isRoot} onClick={handleOpen}>
            <IconDatabaseCog />
          </MuiIconButton>
          <DatabaseDialog />
          {/* remove db */}
          <MuiIconButton disabled={!isRoot} onClick={handleRemoveDB}>
            <RemoveIcon />
          </MuiIconButton>
          {/* refresh tree */}
          <MuiIconButton disabled={!isRoot} onClick={handleRefresh}>
            <IconRefresh />
          </MuiIconButton>
        </Stack>
      </ToolbarBox>
    </>
  );
}
