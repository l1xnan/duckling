import { Box, BoxProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAtomValue } from 'jotai';
import { nanoid } from 'nanoid';
import { useEffect } from 'react';

import ConfigDialog from '@/pages/sidebar/ConfigDialog';
import RenameDialog from '@/pages/sidebar/RenameDialog';
import { SideToolbar } from '@/pages/sidebar/SideToolbar';
import { configAtom, dbListAtom, renameAtom } from '@/stores/dbList';
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

  async function openUrl() {
    const path: string = await invoke('opened_urls');
    console.log('opened_urls', path);
    if (path?.length > 0) {
      const item: TableContextType = {
        id: nanoid(),
        dbId: ':memory:',
        tableId: path,
        displayName: path.replaceAll('\\', '/').split('/').at(-1) ?? path,
        type: 'file',
      };
      updateTab!(item);
    }
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
