import { TreeInstance } from '@headless-tree/core';
import { Trans, useLingui } from '@lingui/react/macro';
import { invoke } from '@tauri-apps/api/core';
import { History, X } from 'lucide-react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

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
  const [historyOpen, setHistoryOpen] = useState(false);

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
        <div className="relative">
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
            className="pr-8"
          />
          <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
            <PopoverTrigger
              className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label={t`Recent searches`}
            >
              <History className="size-4" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-64 max-w-[calc(100vw-2rem)] p-1"
            >
              <div className="flex items-center justify-between px-2">
                <span className="text-xs text-muted-foreground">
                  <Trans>Recent searches</Trans>
                </span>
                {history.length > 0 ? (
                  <button
                    type="button"
                    className="rounded px-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      clearHistory();
                      setHistoryOpen(false);
                    }}
                  >
                    <Trans>Clear</Trans>
                  </button>
                ) : null}
              </div>
              {history.length === 0 ? (
                <p className="px-2 py-2 text-center text-xs text-muted-foreground">
                  <Trans>No recent searches</Trans>
                </p>
              ) : (
                history.map((term) => (
                  <button
                    key={term}
                    type="button"
                    title={term}
                    className="flex w-full items-center gap-1 rounded-sm py-1.5 pr-1 pl-2 text-left outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      commitSearch(term);
                      setHistoryOpen(false);
                    }}
                  >
                    <span className="flex-1 truncate text-xs">{term}</span>
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={t`Remove`}
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeHistory(term);
                      }}
                    >
                      <X className="size-3.5" />
                    </span>
                  </button>
                ))
              )}
            </PopoverContent>
          </Popover>
        </div>
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
