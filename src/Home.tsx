import CloseIcon from '@mui/icons-material/Close';
import TabContext from '@mui/lab/TabContext';
import { Box, BoxProps, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useMemo } from 'react';

import { MemoDataset, PageProvider } from '@/components/Dataset';
import { Content, Layout, Sidebar } from '@/components/Layout';
import { PageTab, PageTabList, PageTabPanel } from '@/components/PageTabs';
import SidebarTree from '@/components/sidebar';
import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';
import Editor from '@/pages/editor/Editor';
import { useDBListStore } from '@/stores/dbList';
import { useTabsStore } from '@/stores/tabs';

export const DatasetEmpty = styled((props) => <Box {...props} />)<BoxProps>(
  () => ({
    display: 'flex',
    marginTop: '20%',
    height: '100%',
    justifyContent: 'center',
  }),
);

function Home() {
  const size = useDBListStore((state) => state.size);
  const setSize = useDBListStore((state) => state.setSize);
  const tabs = useTabsStore((state) => state.tabs);
  const activateTab = useTabsStore((state) => state.active);
  const removeTab = useTabsStore((state) => state.remove);
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
            {tab.type === 'editor' ? <Editor /> : <MemoDataset />}
          </PageTabPanel>
        </PageProvider>
      );
    });
  }, [tabs]);

  const [targetRefLeft, sizeLeft, actionLeft] = useResize(
    size,
    'left',
    setSize,
  );

  return (
    <Layout>
      <Box
        ref={targetRefLeft}
        className={classes.sideBar}
        sx={{ width: sizeLeft + 'px' }}
      >
        <Sidebar>
          <SidebarTree />
        </Sidebar>
        <div className={classes.controls}>
          <div className={classes.resizeVertical} onMouseDown={actionLeft} />
        </div>
      </Box>
      <Content sx={{ ml: `${sizeLeft}px` }}>
        <TabContext value={currentTab?.id ?? ''}>
          <Box>{tabs?.length > 0 ? tabList : <DatasetEmpty />}</Box>
          <Box sx={{ height: '100%' }}>{items}</Box>
        </TabContext>
      </Content>
    </Layout>
  );
}

export default Home;
