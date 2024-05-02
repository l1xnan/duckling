import {
  DefaultTab,
  PageTabs,
  TabItemContextMenu,
} from '@/components/PageTabs';
import {
  ColumnSchemaView,
  DatabaseSchemaView,
  TableView,
} from '@/components/views';
import {
  SchemaContextType,
  TabContextType,
  TableContextType,
  useTabsStore,
} from '@/stores/tabs';

import { SearchView } from '@/components/views/SchemaView';
import { PageProvider } from '@/hooks/context';
import MonacoEditor from './editor';

function TabContent({ id, tab }: { id: string; tab: TabContextType }) {
  // const tabAtom = useTabsAtom(tabObjAtom, id);
  // const tab = useAtomValue(tabAtom);
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
  const { activateTab, removeTab, removeOtherTab, tabObj, ids, currentId } =
    useTabsStore((s) => ({
      activateTab: s.active,
      removeTab: s.remove,
      removeOtherTab: s.removeOther,
      tabObj: s.tabs,
      currentId: s.currentId,
      ids: s.ids,
    }));

  const items = ids.map((id) => {
    const tab = tabObj[id];
    return { tab, children: <TabContent id={tab.id} tab={tab} /> };
  });

  return (
    <PageTabs
      items={items}
      onChange={(value) => activateTab(value)}
      activeKey={currentId ?? ''}
      renderItem={({ tab }: { tab: TabContextType }) => (
        <TabItemContextMenu
          tab={tab}
          onRemove={removeTab}
          onRemoveOther={removeOtherTab}
        >
          <DefaultTab tab={tab} onRemove={removeTab} />
        </TabItemContextMenu>
      )}
    />
  );
}
