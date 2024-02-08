import { Box, BoxProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import { invoke } from '@tauri-apps/api/core';
import { useAtomValue } from 'jotai';
import { nanoid } from 'nanoid';
import { useEffect } from 'react';

import { getDB } from '@/api';
import ConfigDialog from '@/pages/sidebar/ConfigDialog';
import RenameDialog from '@/pages/sidebar/RenameDialog';
import { SideToolbar } from '@/pages/sidebar/SideToolbar';
import {
  configAtom,
  dbListAtom,
  renameAtom,
  useDBListStore,
} from '@/stores/dbList';
import { TableContextType, useTabsStore } from '@/stores/tabs';

import DBTreeView from './DBTreeView';

const TreeViewWrapper = styled(Box)<BoxProps>(() => ({
  width: '100%',
  maxHeight: 'calc(100vh - 64px)',
  height: 'calc(100vh - 64px)',
  overflow: 'auto',
  pr: 1,
  pb: 2,
}));

function Sidebar() {
  const dbList = useAtomValue(dbListAtom);
  const renameContext = useAtomValue(renameAtom);
  const configContext = useAtomValue(configAtom);
  const updateTab = useTabsStore((state) => state.update);
  const appendDB = useDBListStore((state) => state.append);

  async function openUrl() {
    const path: string = await invoke('opened_urls');
    console.log('opened_urls', path);
    if (path?.endsWith('.parquet')) {
      const item: TableContextType = {
        id: nanoid(),
        dbId: ':memory:',
        tableId: path,
        displayName: path.replaceAll('\\', '/').split('/').at(-1) ?? path,
        type: 'file',
      };
      updateTab!(item);
    } else if (path?.endsWith('.duckdb')) {
      const data = await getDB({ path, dialect: 'duckdb' });
      appendDB(data);
    }
  }

  useEffect(() => {
    (async () => {
      await openUrl();
    })();
  }, []);

  return (
    <>
      <SideToolbar />

      <TreeViewWrapper>
        {dbList.map((db, _i) => {
          return <DBTreeView key={db.id} db={db} />;
        })}
      </TreeViewWrapper>
      {/* <TreeViewWrapper>
        <IndexPage data={dbList.map((db) => db.data)} />
      </TreeViewWrapper> */}

      {/* ---------- modal/dialog ---------- */}

      {/* rename */}
      {renameContext !== null ? <RenameDialog /> : null}
      {/* db config */}
      {configContext !== null ? <ConfigDialog /> : null}
    </>
  );
}

export default Sidebar;
