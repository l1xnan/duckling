import { useAtomValue } from 'jotai';

import { Dataset, PageProvider } from '@/components/Dataset';
import { PageTabs } from '@/components/PageTabs';
import { tabsAtomsAtom, useTabsStore } from '@/stores/tabs';

import MonacoEditor from './editor';

export function Main() {
  const activateTab = useTabsStore((state) => state.active);
  const removeTab = useTabsStore((state) => state.remove);
  const currentTab = useTabsStore((state) => state.currentTab);

  const tabsAtoms = useAtomValue(tabsAtomsAtom);

  const items = tabsAtoms.map((tabAtom) => {
    const tab = useAtomValue(tabAtom);
    const children = (
      <>
        {tab.type === 'editor' ? (
          <MonacoEditor context={tabAtom} />
        ) : (
          <PageProvider context={tab}>
            <Dataset context={tab} />
          </PageProvider>
        )}
      </>
    );

    return { tab, children };
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
