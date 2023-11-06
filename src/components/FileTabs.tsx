import { TabList, TabPanelProps, useTabContext } from '@mui/lab';
import { Box, Tab, TabProps, styled } from '@mui/material';
import { FunctionComponent, PropsWithChildren } from 'react';

import { borderTheme, isDarkTheme } from '@/utils';

export const FileTabList = styled(TabList)(({ theme }) => ({
  borderBottom: borderTheme(theme),
  maxHeight: '32px',
  minHeight: '32px',
  backgroundColor: isDarkTheme(theme) ? '#26282e' : 'white',
  '& .MuiTabs-indicator': {},
}));

export const FileTab = styled((props: TabProps) => (
  <Tab disableRipple {...props} />
))(({ theme }) => ({
  minHeight: '32px',
  maxHeight: '32px',
  textTransform: 'none',
  minWidth: 0,
  margin: 0,
  padding: 0,
  paddingLeft: 9,
  [theme.breakpoints.up('sm')]: {
    minWidth: 0,
  },
  fontWeight: theme.typography.fontWeightRegular,
  marginRight: theme.spacing(1),
  opacity: 0.8,
  '&:hover': {
    opacity: 1,
  },
  '&.Mui-selected': {
    fontWeight: theme.typography.fontWeightMedium,
  },
  '&.Mui-focusVisible': {
    backgroundColor: '#d1eaff',
  },
}));

export const FileTabPanel: FunctionComponent<
  PropsWithChildren<TabPanelProps>
> = ({ children, value }) => {
  const { value: contextValue } = useTabContext() || {};
  return (
    <Box
      sx={{
        display: value === contextValue ? 'block' : 'none',
        height: '100%',
      }}
      key={value}
    >
      {children}
    </Box>
  );
};
