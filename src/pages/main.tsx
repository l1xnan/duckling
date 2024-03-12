import { PrimitiveAtom, useAtomValue } from 'jotai';

import { Dataset, PageProvider } from '@/components/Dataset';
import { PageTabs } from '@/components/PageTabs';
import { ColumnSchema, DatabaseSchema } from '@/components/Schema';
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

import MonacoEditor from './editor';

function TabContent({ tabAtom }: { tabAtom: PrimitiveAtom<TabContextType> }) {
  const tab = useAtomValue(tabAtom);
  if (tab.type === 'schema') {
    return (
      <PageProvider context={tab}>
        <DatabaseSchema context={tab as SchemaContextType} />
      </PageProvider>
    );
  }
  if (tab.type === 'column') {
    return (
      <PageProvider context={tab}>
        <ColumnSchema context={tab as TableContextType} />
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
      <Dataset context={tab} />
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
