import { Box, BoxProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import { invoke } from '@tauri-apps/api/core';
import { useAtomValue } from 'jotai';
import { nanoid } from 'nanoid';
import { useEffect, useState } from 'react';

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
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input.tsx';

function Sidebar() {
  const dbList = useAtomValue(dbListAtom);
  const renameContext = useAtomValue(renameAtom);
  const configContext = useAtomValue(configAtom);
  const updateTab = useTabsStore((state) => state.update);
  const appendDB = useDBListStore((state) => state.append);

  const [search, setSearch] = useState('');

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
      <div className="bg-background/95 p-0 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Search"
            className="h-8 pl-8 py-0.5 text-xs focus-visible:ring-0"
          />
        </div>
      </div>
      <div className="w-full max-h-[calc(100vh-94px)] overflow-auto pr-1 pb-2">
        {dbList.map((db, _i) => {
          return <DBTreeView key={db.id} db={db} filter={search} />;
        })}
      </div>

      {/* ---------- modal/dialog ---------- */}

      {/* rename */}
      {renameContext !== null ? <RenameDialog /> : null}
      {/* db config */}
      {configContext !== null ? <ConfigDialog /> : null}
    </>
  );
}

export default Sidebar;
