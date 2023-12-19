import CloseIcon from '@mui/icons-material/Close';
import { TabContext } from '@mui/lab';
import { Box, IconButton } from '@mui/material';
import { useMemo } from 'react';

import { DatasetEmpty } from '@/Home';
import { MemoDataset, PageProvider } from '@/components/Dataset';
import ErrorBoundary from '@/components/ErrorBoundary';
import { PageTab, PageTabList, PageTabPanel } from '@/components/PageTabs';
import { useTabsStore } from '@/stores/tabs';

import MonacoEditor from './editor/MonacoEditor';

export function Content() {
  const activateTab = useTabsStore((state) => state.active);
  const removeTab = useTabsStore((state) => state.remove);
  const tabs = useTabsStore((state) => state.tabs);
  const currentTab = useTabsStore((state) => state.currentTab);

  const tabList = useMemo(() => {
    return (
      <PageTabList
        variant="scrollable"
        scrollButtons="auto"
        onChange={(_, value) => activateTab(value)}
      >
        {tabs.map((tab) => {
          return (
            <PageTab
              key={tab.id}
              value={tab.id}
              label={
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box>
                    {tab?.displayName ?? tab?.tableName.split('/').at(-1)}
                  </Box>
                  <IconButton
                    size="small"
                    component="div"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTab(tab.id);
                    }}
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </Box>
              }
            />
          );
        })}
      </PageTabList>
    );
  }, [tabs]);

  const items = useMemo(() => {
    return tabs.map((tab) => {
      return (
        <PageProvider key={tab.id} table={tab}>
          <PageTabPanel value={tab.id}>
            <ErrorBoundary fallback={<p>Something went wrong</p>}>
              {tab.type === 'editor' ? <MonacoEditor /> : <MemoDataset />}
            </ErrorBoundary>
          </PageTabPanel>
        </PageProvider>
      );
    });
  }, [tabs]);
  return (
    <TabContext value={currentTab?.id ?? ''}>
      <Box>{tabs?.length > 0 ? tabList : <DatasetEmpty />}</Box>
      <Box sx={{ height: '100%' }}>{items}</Box>
    </TabContext>
  );
}
