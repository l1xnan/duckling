import { Box, BoxProps, Stack, StackProps, styled } from '@mui/material';

import { borderTheme, isDarkTheme } from '@/utils';

export const ToolbarContainer = styled((props: StackProps) => (
  <Stack
    direction="row"
    alignItems="center"
    justifyContent="space-between"
    {...props}
  >
    {props.children}
  </Stack>
))(({ theme }) => ({
  backgroundColor: isDarkTheme(theme) ? '#2b2d30' : '#f7f8fa',
  height: 32,
  alignItems: 'center',
  borderBottom: borderTheme(theme),
  '& input, & input:focus-visible': {
    border: 'none',
    height: '100%',
    padding: 0,
    outlineWidth: 0,
  },
}));

export const ToolbarBox = styled(Box)<BoxProps>(({ theme }) => ({
  height: 32,
  width: '100%',
  paddingLeft: '1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: borderTheme(theme),
}));
