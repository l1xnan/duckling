import { PageTabs } from '@/components/PageTabs';
import { QueryView } from '@/components/views';
import { PageProvider } from '@/hooks/context';
import { useQuerySessionStore } from '@/stores/tabs';

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
  const tabs =
    useQuerySessionStore((s) => s.byEditor[editorId]?.children) ?? [];
  const removeChild = useQuerySessionStore((s) => s.removeChild);

  const items = tabs.map((tab) => {
    const children = (
      <PageProvider context={tab}>
        <QueryView editorId={editorId} queryId={tab.id} />
      </PageProvider>
    );

    return { tab, children };
  });

  const handleChange = (val: string) => {
    setActiveKey(val);
  };

  const handleRemove = (key: string) => {
    removeChild(editorId, key);
  };

  return (
    <PageTabs
      items={items}
      activeKey={activeKey ?? tabs[0]?.id ?? ''}
      onChange={handleChange}
      onRemove={handleRemove}
    />
  );
}
