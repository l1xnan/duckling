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
  TabContextType,
  TableContextType,
  activeTabAtom,
  tabListAtom,
  tabsAtomsAtom,
  useTabsStore,
} from '@/stores/tabs';

import { SearchView } from '@/components/views/SchemaView.tsx';
import { PageProvider } from '@/hooks/context';
import MonacoEditor from './editor';

function TabContent({ tabAtom }: { tabAtom: PrimitiveAtom<TabContextType> }) {
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
  const activateTab = useTabsStore((state) => state.active);
  const removeTab = useTabsStore((state) => state.remove);
  const removeOtherTab = useTabsStore((state) => state.removeOther);

  const tabs = useAtomValue(tabListAtom);
  const currentTab = useAtomValue(activeTabAtom);

  const tabsAtoms = useAtomValue(tabsAtomsAtom);

  const items = tabsAtoms.map((tabAtom, i) => {
    const tab = tabs[i];
    return { tab, children: <TabContent tabAtom={tabAtom} /> };
  });

  return (
    <PageTabs
      items={items}
      onChange={(value) => activateTab(value)}
      activeKey={currentTab?.id ?? ''}
      onRemove={removeTab}
      onRemoveOther={removeOtherTab}
    />
  );
}
