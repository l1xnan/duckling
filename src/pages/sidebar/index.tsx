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

import { SearchInput } from '@/components/custom/search';
import SearchDialog from '@/pages/sidebar/SearchDialog';
import DBTreeView from './DBTreeView';

function DBTree() {
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
      <div className="bg-background/40">
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
        />
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
      <SearchDialog />
    </>
  );
}

export default DBTree;
