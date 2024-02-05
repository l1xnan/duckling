import { Box, BoxProps, styled } from '@mui/material';

import { borderTheme } from '@/utils';

export const Content = styled(Box)<BoxProps>(({}) => ({
  flexGrow: 1,
  height: '100vh',
  maxHeight: '100vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}));

export const Sidebar = styled(Box)<BoxProps>(({ theme }) => ({
  flexShrink: 0,
  minHeight: '100vh',
  height: '100vh',
  overflow: 'auto',
  width: '100%',
  borderRight: borderTheme(theme),
}));
