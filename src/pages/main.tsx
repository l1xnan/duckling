import { DragDropProvider } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import { useCallback, type ReactNode } from 'react';
import { useShallow } from 'zustand/shallow';

import {
  CloseableItem,
  PageTabs,
  TabItemContextMenu,
} from '@/components/PageTabs';
import { TabPaneLayout } from '@/components/TabPaneLayout';
import {
  ColumnSchemaView,
  DatabaseSchemaView,
  TableView,
} from '@/components/views';
import { SearchView } from '@/components/views/SchemaView';
import { PageProvider } from '@/hooks/context';
import type { PaneLeaf } from '@/stores/tabLayout';
import {
  SchemaContextType,
  TabContextType,
  TableContextType,
  useTabsStore,
} from '@/stores/tabs';

import MonacoEditor from './editor';

function TabContent({ tab }: { id: string; tab: TabContextType }) {
  if (tab.type === 'schema') {
    return (
      <PageProvider context={tab}>
        <DatabaseSchemaView context={tab as SchemaContextType} />
      </PageProvider>
    );
  }
  if (tab.type === 'column') {
    return (
      <PageProvider context={tab}>
        <ColumnSchemaView context={tab as TableContextType} />
      </PageProvider>
    );
  }
  if (tab.type === 'search') {
    return (
      <PageProvider context={tab}>
        <SearchView context={tab as TableContextType} />
      </PageProvider>
    );
  }
  if (tab.type === 'editor') {
    return (
      <PageProvider context={tab}>
        <MonacoEditor context={tab} />
      </PageProvider>
    );
  }

  return (
    <PageProvider context={tab}>
      <TableView context={tab} />
    </PageProvider>
  );
}

export function Main() {
  const {
    activateTab,
    removeTab,
    removeOtherTab,
    tabObj,
    moveTab,
    focusPane,
  } = useTabsStore(
    useShallow((s) => ({
      activateTab: s.active,
      removeTab: s.remove,
      removeOtherTab: s.removeOther,
      tabObj: s.tabs,
      moveTab: s.moveTab,
      focusPane: s.focusPane,
    })),
  );

  const handleDragEnd = useCallback(
    (event: {
      canceled?: boolean;
      operation: {
        source: { id: string | number; data?: Record<string, unknown>; index?: number; group?: string | number } | null;
        target: { id: string | number; data?: Record<string, unknown>; index?: number; group?: string | number } | null;
      };
    }) => {
      if (event.canceled) return;
      const { source, target } = event.operation;
      if (!source || !target) return;

      const sourceData = source.data as
        | { type?: string; tabId?: string; paneId?: string }
        | undefined;
      if (sourceData?.type !== 'tab' || !sourceData.tabId) return;

      const tabId = sourceData.tabId;

      // Dropped on another tab (sortable)
      if (isSortable(source as never) && isSortable(target as never)) {
        const targetData = target.data as
          | { type?: string; tabId?: string; paneId?: string }
          | undefined;
        const toPaneId =
          (targetData?.paneId as string | undefined) ??
          (typeof target.group === 'string' ? target.group : undefined);
        if (!toPaneId) return;
        const index =
          typeof target.index === 'number' ? target.index : undefined;
        moveTab(tabId, toPaneId, index);
        focusPane(toPaneId);
        return;
      }

      // Dropped on empty pane droppable
      const targetData = target.data as
        | { type?: string; paneId?: string }
        | undefined;
      if (targetData?.type === 'pane' && targetData.paneId) {
        moveTab(tabId, targetData.paneId);
        focusPane(targetData.paneId);
      }
    },
    [focusPane, moveTab],
  );

  const renderPane = useCallback(
    (leaf: PaneLeaf, focused: boolean) => {
      const items = leaf.tabIds
        .map((id) => {
          const tab = tabObj[id];
          if (!tab) return null;
          return {
            tab,
            children: <TabContent id={tab.id} tab={tab} />,
          };
        })
        .filter(Boolean) as { tab: TabContextType; children: ReactNode }[];

      return (
        <PageTabs
          paneId={leaf.id}
          paneFocused={focused}
          items={items}
          indicator="bottom"
          onChange={(value) => {
            focusPane(leaf.id);
            activateTab(value);
          }}
          activeKey={leaf.activeId ?? ''}
          renderItem={({ tab }: { tab: TabContextType }) => (
            <TabItemContextMenu
              tab={tab}
              onRemove={removeTab}
              onRemoveOther={removeOtherTab}
            >
              <CloseableItem tab={tab} onRemove={removeTab} />
            </TabItemContextMenu>
          )}
        />
      );
    },
    [activateTab, focusPane, removeOtherTab, removeTab, tabObj],
  );

  return (
    <DragDropProvider onDragEnd={handleDragEnd as never}>
      <TabPaneLayout renderPane={renderPane} />
    </DragDropProvider>
  );
}
