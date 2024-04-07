import { PrimitiveAtom, useAtomValue } from 'jotai';

import { PageTabs } from '@/components/PageTabs';
import {
  ColumnSchemaView,
  DatabaseSchemaView,
  TableView,
} from '@/components/views';
import {
  EditorContextType,
  SchemaContextType,
  TableContextType,
  tabObjAtom,
  useTabsAtom,
  useTabsStore,
} from '@/stores/tabs';

import { SearchView } from '@/components/views/SchemaView';
import { PageProvider } from '@/hooks/context';
import MonacoEditor from './editor';

function TabContent({ id }: { id: string }) {
  const tabAtom = useTabsAtom(tabObjAtom, id);
  const tab = useAtomValue(tabAtom);
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
      <MonacoEditor context={tabAtom as PrimitiveAtom<EditorContextType>} />
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
    useTabsStore((state) => ({
      activateTab: state.active,
      removeTab: state.remove,
      removeOtherTab: state.removeOther,
      tabObj: state.tabs,
      currentId: state.currentId,
      ids: state.ids,
    }));

  const items = ids.map((id) => {
    const tab = tabObj[id];
    return { tab, children: <TabContent id={tab.id} /> };
  });

  return (
    <PageTabs
      items={items}
      onChange={(value) => activateTab(value)}
      activeKey={currentId ?? ''}
      onRemove={removeTab}
      onRemoveOther={removeOtherTab}
    />
  );
}
