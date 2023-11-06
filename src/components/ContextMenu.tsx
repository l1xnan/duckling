import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  MenuItemProps,
  MenuProps,
  styled,
} from '@mui/material';
import { ReactNode } from 'react';

import { isDarkTheme } from '@/utils';

export const ContextMenu = styled((props: MenuProps) => <Menu {...props} />)(
  ({ theme }) => ({
    '& .MuiPaper-root': {
      // borderRadius: 0,
      backgroundColor: isDarkTheme(theme) ? '#2b2d30' : '#ffffff',
      color: !isDarkTheme(theme) ? 'rgb(55, 65, 81)' : theme.palette.grey[300],
      border: isDarkTheme(theme) ? '1px solid #43454a' : '1px solid #b9bdc9',
      boxShadow:
        'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1)  10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
    },
    '& .MuiDivider-root': {
      marginTop: '4px',
      marginBottom: '4px',
    },
  }),
);

interface ContextMenuItemProps extends MenuItemProps {
  icon?: ReactNode;
}

export const ContextMenuItem = styled((props: ContextMenuItemProps) => (
  <MenuItem dense {...props}>
    {props.icon ? (
      <ListItemIcon
        sx={{
          '& svg': {
            height: 16,
            width: 16,
          },
        }}
      >
        {props.icon}
      </ListItemIcon>
    ) : null}
    <ListItemText>{props.children}</ListItemText>
  </MenuItem>
))(({ theme }) => ({
  paddingLeft: '8px',
  paddingRight: '8px',
  marginLeft: '8px',
  marginRight: '8px',
  borderRadius: '4px',
  minHeight: 0,

  '&:hover': {
    backgroundColor: isDarkTheme(theme) ? '#2e436e' : '#d4e2ff',
  },

  '& .MuiListItemIcon-root': {
    maxWidth: '24px',
    minWidth: 0,
    width: '24px',
  },
}));
