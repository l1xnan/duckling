import { invoke } from '@tauri-apps/api/core';
import { useAtomValue } from 'jotai';
import { nanoid } from 'nanoid';
import { useEffect, useRef, useState } from 'react';

import { getDB } from '@/api';
import ConfigDialog from '@/pages/sidebar/dialog/ConfigDialog';
import { SideToolbar } from '@/pages/sidebar/SideToolbar';
import { configAtom, dbListAtom, useDBListStore } from '@/stores/dbList';
import { TableContextType, useTabsStore } from '@/stores/tabs';

import { TreeView3 } from '@/components/custom/TreeView3';
import { SearchInput } from '@/components/custom/search';
import { TreeInstance } from '@headless-tree/core';

function useInitOpenUrl() {
  const updateTab = useTabsStore((s) => s.update);
  const appendDB = useDBListStore((s) => s.append);

  async function openUrl() {
    const path: string = await invoke('opened_urls');
    console.warn('opened_urls', path);
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
}

function DBTree() {
  const dbList = useAtomValue(dbListAtom);
  const configContext = useAtomValue(configAtom);

  useInitOpenUrl();

  const [search, setSearch] = useState('');

  const treeRef = useRef<TreeInstance<unknown>>(null);

  const handleExpandAll = () => {
    treeRef.current?.expandAll();
  };
  const handleCollapseAll = () => {
    treeRef.current?.collapseAll();
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <SideToolbar
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
      />
      <div className="bg-background/40">
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
        />
      </div>
      {/* <TreeDemo
        searchMatch={(node, term) =>
          node.data.path.toLowerCase().includes(term.toLowerCase())
        }
        searchTerm={search}
        data={dbList.map((db) => ({
          ...convertId(db.data, db.id, db.displayName),
          icon: db.dialect,
        }))}
      /> */}

      <TreeView3 dbList={dbList} search={search} ref={treeRef} />
      {/* <div className="size-full overflow-x-hidden pr-1 pb-2">
        {dbList.map((db, _i) => {
          return <DBTreeView key={db.id} db={db} filter={search} />;
        })}
      </div> */}

      {/* ---------- modal/dialog ---------- */}

      {/* db config */}
      {configContext !== null ? <ConfigDialog /> : null}
    </div>
  );
}

export default DBTree;
