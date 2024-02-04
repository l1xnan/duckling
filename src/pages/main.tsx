import { PrimitiveAtom, useAtomValue } from 'jotai';

import { Dataset, PageProvider } from '@/components/Dataset';
import { PageTabs } from '@/components/PageTabs';
import {
  EditorContextType,
  TabContextType,
  activeTabAtom,
  tabListAtom,
  tabsAtomsAtom,
  useTabsStore,
} from '@/stores/tabs';

import MonacoEditor from './editor';

function TabContent({ tabAtom }: { tabAtom: PrimitiveAtom<TabContextType> }) {
  const tab = useAtomValue(tabAtom);
  return tab.type === 'editor' ? (
    <MonacoEditor context={tabAtom as PrimitiveAtom<EditorContextType>} />
  ) : (
    <PageProvider context={tab}>
      <Dataset context={tab} />
    </PageProvider>
  );
}

export function Main() {
  const activateTab = useTabsStore((state) => state.active);
  const removeTab = useTabsStore((state) => state.remove);

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
    />
  );
}
