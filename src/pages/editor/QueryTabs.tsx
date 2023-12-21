import { PrimitiveAtom, useAtom, useAtomValue } from 'jotai';
import { splitAtom } from 'jotai/utils';

import { PageTabs } from '@/components/PageTabs';
import { QueryContextType } from '@/stores/tabs';

import DatasetItem, { PageProvider } from './DatasetItem';

export interface QueryTabsProps {
  subTabsAtom: PrimitiveAtom<QueryContextType[]>;
  activeKey: string | null;
  setActiveKey: (key: string) => void;
}

export function QueryTabs({
  subTabsAtom,
  activeKey,
  setActiveKey,
}: QueryTabsProps) {
  const subTabsAtomsAtom = splitAtom(subTabsAtom);
  const subTabsAtoms = useAtomValue(subTabsAtomsAtom);
  const [subTabs, setSubTabs] = useAtom(subTabsAtom);
  const items =
    subTabsAtoms?.map((subTabAtom, i) => {
      const tab = subTabs[i];
      const children = (
        <PageProvider table={tab}>
          <DatasetItem context={subTabAtom} />
        </PageProvider>
      );

      return { tab, children };
    }) ?? [];

  const handleChange = (val: string) => {
    setActiveKey(val);
  };
  const handleRemove = (val: string) => {
    setSubTabs((prev) => prev.filter((item) => item.id != val));
  };
  return (
    <PageTabs
      items={items}
      activeKey={activeKey ?? ''}
      onChange={handleChange}
      onRemove={handleRemove}
    />
  );
}
