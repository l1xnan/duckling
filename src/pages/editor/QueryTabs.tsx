import type { ReactElement } from 'react';

import { PageTabs } from '@/components/PageTabs';
import { QueryView } from '@/components/views';
import { PageProvider } from '@/hooks/context';
import {
  EMPTY_BY_ID,
  EMPTY_ORDER,
  useQuerySessionStore,
  type QueryContextType,
} from '@/stores/tabs';

export interface QueryTabsProps {
  editorId: string;
  activeKey?: string;
  setActiveKey: (key?: string) => void;
}

export function QueryTabs({
  editorId,
  activeKey,
  setActiveKey,
}: QueryTabsProps) {
  const order = useQuerySessionStore(
    (s) => s.byEditor[editorId]?.order ?? EMPTY_ORDER,
  );
  const byId = useQuerySessionStore(
    (s) => s.byEditor[editorId]?.byId ?? EMPTY_BY_ID,
  );
  const removeChild = useQuerySessionStore((s) => s.removeChild);

  const items = order
    .map((queryId) => {
      const tab = byId[queryId];
      if (!tab) {
        return null;
      }
      const children = (
        <PageProvider context={tab}>
          <QueryView editorId={editorId} queryId={queryId} />
        </PageProvider>
      );
      return { tab, children };
    })
    .filter(
      (item): item is { tab: QueryContextType; children: ReactElement } =>
        item != null,
    );

  const handleChange = (val: string) => {
    setActiveKey(val);
  };

  const handleRemove = (key: string) => {
    removeChild(editorId, key);
  };

  return (
    <PageTabs
      items={items}
      activeKey={activeKey ?? order[0] ?? ''}
      onChange={handleChange}
      onRemove={handleRemove}
    />
  );
}
