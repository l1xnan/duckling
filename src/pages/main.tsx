import { DragDropProvider, PointerSensor } from '@dnd-kit/react';
import { useCallback, useMemo, type ReactNode } from 'react';
import { useShallow } from 'zustand/shallow';

import {
  CloseableItem,
  PageTabs,
  TabItemContextMenu,
} from '@/components/PageTabs';
import { TabPaneLayout } from '@/components/TabPaneLayout';
import {
  resolveTabDrop,
  takePendingDrop,
  TabDragSessionProvider,
  type ResolvedTabDrop,
} from '@/components/tabDragSession';
import {
  ColumnSchemaView,
  DatabaseSchemaView,
  TableView,
} from '@/components/views';
import { SearchView } from '@/components/views/SchemaView';
import { PageProvider } from '@/hooks/context';
import { findLeafByTab, type PaneLeaf } from '@/stores/tabLayout';
import {
  SchemaContextType,
  TabContextType,
  TableContextType,
  useTabsStore,
} from '@/stores/tabs';

import MonacoEditor from './editor';

function TabContent({ tab }: { tab: TabContextType }) {
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

function isAlreadyAtDrop(
  tabIds: string[],
  tabId: string,
  index: number | undefined,
): boolean {
  const fromIdx = tabIds.indexOf(tabId);
  if (fromIdx < 0) return false;
  if (index === undefined) return fromIdx === tabIds.length - 1;
  return index === fromIdx || index === fromIdx + 1;
}

function applyDrop(drop: ResolvedTabDrop) {
  const state = useTabsStore.getState();
  const from = findLeafByTab(state.layout, drop.tabId);
  if (!from) {
    return;
  }

  if (drop.bodyZone) {
    state.dropOnPane(drop.tabId, drop.toPaneId, drop.bodyZone);
    return;
  }

  if (
    from.id === drop.toPaneId &&
    isAlreadyAtDrop(from.tabIds, drop.tabId, drop.index)
  ) {
    if (state.focusedPaneId !== drop.toPaneId) {
      state.focusPane(drop.toPaneId);
    }
    return;
  }

  state.moveTab(drop.tabId, drop.toPaneId, drop.index);
  state.focusPane(drop.toPaneId);
}

export function Main() {
  const {
    activateTab,
    removeTab,
    removeOtherTab,
    tabObj,
    focusPane,
  } = useTabsStore(
    useShallow((s) => ({
      activateTab: s.active,
      removeTab: s.remove,
      removeOtherTab: s.removeOther,
      tabObj: s.tabs,
      focusPane: s.focusPane,
    })),
  );

  const handleDragEnd = useCallback(
    (event: {
      canceled?: boolean;
      operation: {
        source: unknown;
        target: unknown;
        position?: { current?: { x?: number }; x?: number };
      };
    }) => {
      if (event.canceled) {
        takePendingDrop();
        return;
      }
      const { source, target } = event.operation;
      const fromOver = takePendingDrop();
      const fromEnd =
        source && target
          ? resolveTabDrop(source, target, event.operation)
          : null;
      const drop = fromOver ?? fromEnd;
      if (!drop) return;

      queueMicrotask(() => {
        applyDrop(drop);
      });
    },
    [],
  );

  const renderPane = useCallback(
    (leaf: PaneLeaf, focused: boolean) => {
      const items = leaf.tabIds
        .map((id) => {
          const tab = tabObj[id];
          if (!tab) return null;
          return {
            tab,
            children: <TabContent tab={tab} />,
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

  const sensors = useMemo(() => [PointerSensor], []);

  return (
    <DragDropProvider
      sensors={sensors as never}
      onDragEnd={handleDragEnd as never}
    >
      <TabDragSessionProvider>
        <TabPaneLayout renderPane={renderPane} />
      </TabDragSessionProvider>
    </DragDropProvider>
  );
}
