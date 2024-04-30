import { Empty } from '@/components/Empty';
import ErrorBoundary from '@/components/ErrorBoundary';
import { borderTheme, isDarkTheme } from '@/utils';
import { TabContext, TabList, TabPanelProps, useTabContext } from '@mui/lab';
import { Tab, TabProps, styled } from '@mui/material';
import { FunctionComponent, PropsWithChildren, useMemo } from 'react';
import { PageTabsProps } from '../PageTabs';

export const PageTabList = styled(TabList)(({ theme }) => ({
  borderBottom: borderTheme(theme),
  maxHeight: '2rem',
  minHeight: '2rem',
  backgroundColor: isDarkTheme(theme) ? '#26282e' : 'white',
  '& .MuiTabs-indicator': {},
}));

export const PageTab = styled((props: TabProps) => (
  <Tab disableRipple {...props} />
))(({ theme }) => ({
  maxHeight: '2rem',
  minHeight: '2rem',
  textTransform: 'none',
  minWidth: 0,
  margin: 0,
  marginRight: 0,
  padding: 0,
  borderRight: isDarkTheme(theme) ? '1px solid #1e1e1e' : '1px solid #e5e5e5',
  paddingLeft: 9,
  [theme.breakpoints.up('sm')]: {
    minWidth: 0,
  },
  fontWeight: theme.typography.fontWeightRegular,
  paddingRight: theme.spacing(1),
  opacity: 0.8,
  '&:hover': {
    opacity: 1,
  },
  '& .tab-close-icon': {
    visibility: 'hidden',
  },
  '&.Mui-selected .tab-close-icon': {
    visibility: 'visible',
  },
  '&:hover .tab-close-icon': {
    visibility: 'visible',
  },
  '&.Mui-selected': {
    fontWeight: theme.typography.fontWeightMedium,
    opacity: 1,
    backgroundColor: isDarkTheme(theme) ? '#1f1f1f' : '#f6f8fa',
  },
  '&.Mui-focusVisible': {
    backgroundColor: '#d1eaff',
  },
}));

export const PageTabPanel: FunctionComponent<
  PropsWithChildren<TabPanelProps>
> = ({ children, value }) => {
  const { value: contextValue } = useTabContext() || {};
  return (
    <div hidden={value !== contextValue} className="h-full" key={value}>
      {children}
    </div>
  );
};

export function PageTabs1({
  items,
  activeKey,
  fallback,
  onChange,
  renderItem,
}: PageTabsProps) {
  const tabList = useMemo(() => {
    return (
      <PageTabList
        variant="scrollable"
        scrollButtons="auto"
        onChange={(_, value) => onChange(value)}
      >
        {items.map(({ tab }) => {
          return (
            <PageTab key={tab.id} value={tab.id} label={renderItem({ tab })} />
          );
        })}
      </PageTabList>
    );
  }, [items]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <TabContext value={activeKey}>
        <div>{items?.length > 0 ? tabList : <Empty />}</div>
        <div className="h-full flex-1">
          {items.map((item) => {
            const tab = item.tab;
            return (
              <PageTabPanel key={tab.id} value={tab.id}>
                <ErrorBoundary
                  fallback={fallback ?? <p>Something went wrong</p>}
                >
                  {item.children}
                </ErrorBoundary>
              </PageTabPanel>
            );
          })}
        </div>
      </TabContext>
    </div>
  );
}
