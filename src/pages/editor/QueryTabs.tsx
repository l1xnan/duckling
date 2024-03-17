import { PrimitiveAtom, useAtom, useAtomValue } from 'jotai';
import { splitAtom } from 'jotai/utils';

import { PageTabs } from '@/components/PageTabs';
import { QueryView } from '@/components/views';
import { PageProvider } from '@/hooks/context';
import { QueryContextType } from '@/stores/tabs';

export interface QueryTabsProps {
  tabsAtom: PrimitiveAtom<QueryContextType[]>;
  activeKey?: string;
  setActiveKey: (key?: string) => void;
}

export function QueryTabs({
  tabsAtom,
  activeKey,
  setActiveKey,
}: QueryTabsProps) {
  const tabsAtomsAtom = splitAtom(tabsAtom);
  const tabsAtoms = useAtomValue(tabsAtomsAtom);
  const [tabs, setTabs] = useAtom(tabsAtom);

  const items =
    tabsAtoms?.map((tabAtom, i) => {
      const tab = tabs[i];
      const children = (
        <PageProvider context={tab}>
          <QueryView context={tabAtom} />
        </PageProvider>
      );

      return { tab, children };
    }) ?? [];

  const handleChange = (val: string) => {
    setActiveKey(val);
  };

  const handleRemove = (key: string) => {
    setTabs((prev) => prev.filter((item) => item.id != key));

    const delIndex = tabs.findIndex(({ id }) => id === key);

    if (key == activeKey) {
      const newActiveKey =
        tabs[delIndex - 1]?.id || tabs[delIndex + 1]?.id || undefined;
      setActiveKey(newActiveKey);
    }
  };

  const handleRemoveOther = (key: string) => {
    setTabs((prev) => prev.filter((item) => item.id == key));
    setActiveKey(key);
  };

  return (
    <PageTabs
      items={items}
      activeKey={activeKey ?? tabs[0]?.id ?? ''}
      onChange={handleChange}
      onRemove={handleRemove}
      onRemoveOther={handleRemoveOther}
    />
  );
}
