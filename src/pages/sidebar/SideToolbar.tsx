import RemoveIcon from '@mui/icons-material/Remove';
import {
  IconDatabaseCog,
  IconFolderPlus,
  IconRefresh,
} from '@tabler/icons-react';
import * as dialog from '@tauri-apps/plugin-dialog';
import { useAtomValue, useSetAtom } from 'jotai';

import { getDB } from '@/api';
import { MuiIconButton } from '@/components/MuiIconButton';
import ToggleColorMode from '@/components/ToggleColorMode';
import { Stack, ToolbarContainer } from '@/components/Toolbar';
import Setting from '@/pages/settings/AppSetting';
import { DatabaseDialog } from '@/pages/sidebar/DatabaseDialog';
import {
  DialectType,
  configAtom,
  dbMapAtom,
  selectedNodeAtom,
  useDBListStore,
} from '@/stores/dbList';

export function SideToolbar() {
  const dbList = useDBListStore((state) => state.dbList);
  const appendDB = useDBListStore((state) => state.append);
  const removeDB = useDBListStore((state) => state.remove);
  const updateDB = useDBListStore((state) => state.update);

  const setConfigContext = useSetAtom(configAtom);

  async function handleGetDB(path: string, dialect: DialectType) {
    const data = await getDB({ path, dialect });
    appendDB(data);
  }

  const selectedNode = useAtomValue(selectedNodeAtom);
  const dbMap = useAtomValue(dbMapAtom);

  const handleOpen = () => {
    if (selectedNode) {
      const db = dbMap.get(selectedNode.dbId);
      if (db) {
        setConfigContext(db);
      }
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
          const { data } = await getDB(
            db.config ?? { path: db.data.path, dialect: 'folder' },
          );
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
      <div className="h-8 w-full pl-4 flex items-center justify-between border-b">
        <div className="font-semibold">Database Explorer</div>
        <Stack>
          <ToggleColorMode />
          <Setting />
        </Stack>
      </div>
      <ToolbarContainer>
        <Stack>
          <MuiIconButton onClick={handleAppendFolder}>
            <IconFolderPlus />
          </MuiIconButton>
          <DatabaseDialog />
          {/* <MuiIconButton onClick={handleAppendDB}>
            <IconDatabasePlus />
          </MuiIconButton> */}
          <MuiIconButton disabled={!isRoot} onClick={handleOpen}>
            <IconDatabaseCog />
          </MuiIconButton>
          {/* remove db */}
          <MuiIconButton disabled={!isRoot} onClick={handleRemoveDB}>
            <RemoveIcon />
          </MuiIconButton>
          {/* refresh tree */}
          <MuiIconButton disabled={!isRoot} onClick={handleRefresh}>
            <IconRefresh />
          </MuiIconButton>
        </Stack>
      </ToolbarContainer>
    </>
  );
}
