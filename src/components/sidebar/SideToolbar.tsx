import RemoveIcon from '@mui/icons-material/Remove';
import { Box, BoxProps, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  IconDatabaseCog,
  IconDatabasePlus,
  IconFolderPlus,
  IconRefresh,
} from '@tabler/icons-react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/primitives';
import * as dialog from '@tauri-apps/plugin-dialog';
import { useEffect } from 'react';

import { getFolderTree, showTables } from '@/api';
import { useDBConfigStore } from '@/components/DBConfig';
import { MuiIconButton } from '@/components/MuiIconButton';
import ToggleColorMode from '@/components/ToggleColorMode';
import Setting from '@/pages/Setting';
import { FileNode, useDBStore } from '@/stores/db';
import { DTableType } from '@/stores/store';
import { borderTheme } from '@/utils';

const ToolbarBox = styled(Box)<BoxProps>(({ theme }) => ({
  height: 32,
  width: '100%',
  paddingLeft: '1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: borderTheme(theme),
}));

export function SideToolbar({
  selectedTable,
}: {
  selectedTable: DTableType | null;
}) {
  const dbList = useDBStore((state) => state.dbList);
  const appendDB = useDBStore((state) => state.append);
  const removeDB = useDBStore((state) => state.remove);
  const updateDB = useDBStore((state) => state.update);

  async function openDirectory(name: string) {
    const fileTree = await getFolderTree(name);
    if (fileTree) {
      appendDB({
        data: fileTree,
      });
    }
  }
  async function openUrl() {
    const path: string = await invoke('opened_urls');
    console.log(path);
  }

  useEffect(() => {
    openUrl();
    const unlisten = listen('open-directory', (e) => {
      console.log(e.payload);

      openDirectory(e.payload as string);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const onOpen = useDBConfigStore((state) => state.onOpen);
  const setDB = useDBConfigStore((state) => state.setDB);

  const handleOpen = () => {
    setDB(selectedTable!);
    onOpen();
  };

  async function handleRemoveDB() {
    removeDB(selectedTable?.root!);
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
    if (res) {
      openDirectory(res.path);
    }
  }

  async function handleAppendFolder() {
    const res = await dialog.open({
      directory: true,
    });
    if (res) {
      openDirectory(res);
    }
  }

  async function handleRefresh() {
    console.log(selectedTable);
    if (selectedTable && selectedTable.tableName.endsWith('.duckdb')) {
      const res = await showTables(selectedTable.root);
      console.log(res);

      const views: FileNode[] = [];
      const tables: FileNode[] = [];

      res.data.forEach(({ table_name, table_type }) => {
        const item = {
          name: table_name,
          path: table_name,
          type: table_type == 'VIEW' ? 'view' : 'table',
          is_dir: false,
        };
        if (table_type == 'VIEW') {
          views.push(item);
        } else {
          tables.push(item);
        }
      });

      updateDB({
        path: selectedTable.root,
        children: [
          {
            name: 'tables',
            path: 'tables',
            type: 'path',
            is_dir: true,
            children: tables,
          },
          {
            name: 'views',
            path: 'views',
            type: 'path',
            is_dir: true,
            children: views,
          },
        ],
      });
    }
  }

  const isRoot = dbList
    .map((item) => item.data.path)
    .includes(selectedTable?.tableName!);

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
          <MuiIconButton onClick={handleAppendDB}>
            <IconDatabasePlus />
          </MuiIconButton>
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
      </ToolbarBox>
    </>
  );
}
