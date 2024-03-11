import CloseIcon from '@mui/icons-material/Close';
import { TabContext, TabList, TabPanelProps, useTabContext } from '@mui/lab';
import { Box, IconButton, Tab, TabProps, styled } from '@mui/material';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import {
  FunctionComponent,
  PropsWithChildren,
  ReactNode,
  useMemo,
} from 'react';

import { Empty } from '@/components/Empty';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TabContextType } from '@/stores/tabs';
import { borderTheme, isDarkTheme } from '@/utils';

import { HtmlTooltip } from './custom/Tooltip';
import { ContextMenuItem } from './custom/context-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';

export interface PageTabsProps {
  items: { tab: TabContextType; children: ReactNode }[];
  activeKey: string;
  fallback?: ReactNode;
  onRemove: (key: string) => void;
  onRemoveOther: (key: string) => void;
  onChange: (key: string) => void;
}

export const PageTabList = styled(TabList)(({ theme }) => ({
  borderBottom: borderTheme(theme),
  maxHeight: '32px',
  minHeight: '32px',
  backgroundColor: isDarkTheme(theme) ? '#26282e' : 'white',
  '& .MuiTabs-indicator': {},
}));

export const PageTab = styled((props: TabProps) => (
  <Tab disableRipple {...props} />
))(({ theme }) => ({
  minHeight: '32px',
  maxHeight: '32px',
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
    <Box hidden={value !== contextValue} className="h-full" key={value}>
      {children}
    </Box>
  );
};

export function PageTabs({
  items,
  activeKey,
  fallback,
  onChange,
  onRemove,
  onRemoveOther,
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
            <PageTab
              key={tab.id}
              value={tab.id}
              label={
                <ContextMenu>
                  <ContextMenuTrigger className="w-full">
                    <div className="flex items-center justify-between">
                      <HtmlTooltip title={tab.displayName}>
                        <div className="max-w-52 truncate">
                          {tab.displayName}
                        </div>
                      </HtmlTooltip>
                      <IconButton
                        size="small"
                        className="tab-close-icon"
                        component="div"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(tab.id);
                        }}
                      >
                        <CloseIcon fontSize="inherit" />
                      </IconButton>
                    </div>
                  </ContextMenuTrigger>

                  <ContextMenuContent className="w-64">
                    <ContextMenuItem
                      onClick={async () => {
                        onRemove(tab.id);
                      }}
                    >
                      Close
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={async () => {
                        onRemoveOther(tab.id);
                      }}
                    >
                      Close Other
                    </ContextMenuItem>

                    <ContextMenuSeparator />

                    <ContextMenuItem
                      onClick={async () => {
                        await writeText(tab.displayName);
                      }}
                    >
                      Copy
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              }
            />
          );
        })}
      </PageTabList>
    );
  }, [items]);

  return (
    <div className="h-full">
      <TabContext value={activeKey}>
        <Box>{items?.length > 0 ? tabList : <Empty />}</Box>
        <Box className="h-full">
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
        </Box>
      </TabContext>
    </div>
  );
}

export function PageTabs1({
  items,
  activeKey,
  onChange,
  onRemove,
}: PageTabsProps) {
  return (
    <Tabs
      className="w-full h-full flex flex-col justify-start items-start"
      value={activeKey}
      onValueChange={onChange}
    >
      <TabsList className="p-0 h-8">
        {items.map(({ tab }) => {
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={
                'wm-200 pl-3 pr-1.5 data-[state=active]:border-b-2 data-[state=active]:shadow-none data-[state=active]:rounded-none data-[state=active]:border-gray-900'
              }
            >
              {tab.displayName}
              <IconButton
                size="small"
                component="div"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(tab.id);
                }}
              >
                <CloseIcon fontSize="inherit" />
              </IconButton>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {items.map(({ tab, children }) => {
        return (
          <TabsContent
            key={tab.id}
            value={tab.id}
            forceMount
            hidden={tab.id != activeKey}
            className="h-full w-full mt-0"
          >
            <ErrorBoundary fallback={<p>Something went wrong</p>}>
              {children}
            </ErrorBoundary>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
