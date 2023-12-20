import { useAtomValue } from 'jotai';

import { Dataset, PageProvider } from '@/components/Dataset';
import { PageTabs } from '@/components/PageTabs';
import MonacoEditor from '@/pages/editor/MonacoEditor';
import { tabsAtomsAtom, useTabsStore } from '@/stores/tabs';

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
          <MonacoEditor context={tab} />
        ) : (
          <PageProvider table={tabAtom}>
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
