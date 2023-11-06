import { styled } from '@mui/material';
import {
  PanelResizeHandle,
  PanelResizeHandleProps,
} from 'react-resizable-panels';

import { isDarkTheme } from '@/utils';

export default styled(PanelResizeHandle)<PanelResizeHandleProps>(
  ({ theme }) => ({
    width: '0.1rem',
    backgroundColor: isDarkTheme(theme) ? '#393b40' : '#ebecf0',
    zIndex: 999,
    outline: 'none',
    '&:hover, &[data-resize-handle-active]': {
      backgroundColor: '#0078d4',
    },
  }),
);
