import { TreeInstance } from '@headless-tree/core';
import { useLingui } from '@lingui/react/macro';
import { invoke } from '@tauri-apps/api/core';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getDB } from '@/api';
import { useRevealInSidebar } from '@/hooks/useRevealInSidebar';
import { isLocatableTab } from '@/lib/revealInSidebar';
import { SideToolbar } from '@/pages/sidebar/SideToolbar';
import { useDBListStore } from '@/stores/dbList';
import { useDbSearchHistoryStore } from '@/stores/dbSearchHistory';
import { useQuerySessionStore } from '@/stores/querySession';
import { getEffectiveTab } from '@/stores/reveal';
import { TableContextType, useTabsStore } from '@/stores/tabs';

import { SearchInput } from '@/components/custom/search';
import { TreeView } from '@/components/custom/TreeView';

function useInitOpenFiles() {
  const updateTab = useTabsStore((s) => s.update);
  const appendDB = useDBListStore((s) => s.append);

  async function openFiles() {
    const files: string = await invoke('opened_files');
    console.warn('opened_files', files);
    for (const file of files) {
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
        await appendDB(data);
      }
    }
  }

  useEffect(() => {
    (async () => {
      await openFiles();
    })();
  }, []);
}

export function DBTree({ panelActive = true }: { panelActive?: boolean }) {
  const { t } = useLingui();
  const dbList = useDBListStore((s) => s.dbList);
  const history = useDbSearchHistoryStore((s) => s.terms);
  const pushHistory = useDbSearchHistoryStore((s) => s.push);
  const removeHistory = useDbSearchHistoryStore((s) => s.remove);
  const clearHistory = useDbSearchHistoryStore((s) => s.clear);

  useInitOpenFiles();

  const [search, setSearch] = useState('');

  const treeRef = useRef<TreeInstance<unknown>>(null);
  const reveal = useRevealInSidebar();
  const prepareReveal = useCallback(() => {
    setSearch('');
  }, []);
  const activeTab = useTabsStore((s) =>
    s.currentId ? s.tabs[s.currentId] : undefined,
  );
  // Result sub-tabs are tracked per-editor, not in the main tab store.
  const activeResultKey = useQuerySessionStore((s) =>
    activeTab?.type === 'editor'
      ? (s.byEditor[activeTab.id]?.activeKey ?? null)
      : null,
  );
  const effectiveTab = useMemo(
    () => getEffectiveTab(activeTab, activeResultKey),
    [activeTab, activeResultKey],
  );

  const handleExpandAll = () => {
    treeRef.current?.expandAll();
  };
  const handleCollapseAll = () => {
    treeRef.current?.collapseAll();
  };
  const handleRevealCurrentTab = () => {
    if (effectiveTab) {
      reveal(effectiveTab);
    }
  };

  const commitSearch = (term: string) => {
    const text = term.trim();
    if (!text) {
      return;
    }
    setSearch(text);
    pushHistory(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0">
        <SideToolbar
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          onRevealCurrentTab={handleRevealCurrentTab}
          revealDisabled={!isLocatableTab(effectiveTab)}
        />
      </div>
      <div className="shrink-0 bg-background/40">
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitSearch(search);
            }
          }}
          history={{
            terms: history,
            ariaLabel: t`Recent searches`,
            recentLabel: t`Recent searches`,
            emptyLabel: t`No recent searches`,
            onSelect: commitSearch,
            onRemove: removeHistory,
            onClear: clearHistory,
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <TreeView
          dbList={dbList}
          search={search}
          ref={treeRef}
          revealActive={panelActive}
          onPrepareReveal={prepareReveal}
        />
      </div>
    </div>
  );
}
