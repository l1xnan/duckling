import { invoke } from '@tauri-apps/api/core';
import { nanoid } from 'nanoid';
import { useEffect, useRef, useState } from 'react';

import { getDB } from '@/api';
import { SideToolbar } from '@/pages/sidebar/SideToolbar';
import { useDBListStore } from '@/stores/dbList';
import { TableContextType, useTabsStore } from '@/stores/tabs';

import { SearchInput } from '@/components/custom/search';
import { TreeView3 } from '@/components/custom/TreeView';
import { TreeInstance } from '@headless-tree/core';

function useInitOpenFiles() {
  const updateTab = useTabsStore((s) => s.update);
  const appendDB = useDBListStore((s) => s.append);

  async function openFiles() {
    const files: string = await invoke('opened_files');
    console.warn('opened_files', files);
    for (const file of files){

      if (file?.endsWith('.parquet')) {
        const item: TableContextType = {
          id: nanoid(),
          dbId: ':memory:',
          tableId: file,
          displayName: file.replaceAll('\\', '/').split('/').at(-1) ?? file,
          type: 'file',
        };
        updateTab!(item);
      } else if (file?.endsWith('.duckdb')) {
        const data = await getDB({ path: file, dialect: 'duckdb' });
        appendDB(data);
      }
    }
  }

  useEffect(() => {
    (async () => {
      await openFiles();
    })();
  }, []);
}

function DBTree() {
  const dbList = useDBListStore((s) => s.dbList);

  useInitOpenFiles();

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
      <TreeView3 dbList={dbList} search={search} ref={treeRef} />
    </div>
  );
}

export default DBTree;
