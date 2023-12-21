import SettingsIcon from '@mui/icons-material/Settings';
import {
  Input,
  InputBase,
  ListItem,
  ListItemText,
  OutlinedInput,
} from '@mui/material';
import Box from '@mui/material/Box';
import * as React from 'react';
import { ReactNode } from 'react';

import { DialogBox } from '@/components/DialogBox';
import { MuiIconButton } from '@/components/MuiIconButton';
import { useSettingStore } from '@/stores/setting';

interface ItemProps {
  label: ReactNode;
  extra?: ReactNode;
  children?: ReactNode;
  secondary?: ReactNode;
}

export const SettingItem: React.FC<ItemProps> = (props) => {
  const { label, extra, children, secondary } = props;

  const primary = !extra ? (
    label
  ) : (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Box sx={{ fontSize: '14px' }}>{label}</Box>
      {extra}
    </Box>
  );

  return (
    <ListItem sx={{ pt: '5px', pb: '5px' }}>
      <ListItemText primary={primary} secondary={secondary} />
      {children}
    </ListItem>
  );
};

export default function MaxWidthDialog() {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const setStore = useSettingStore((state) => state.setStore);
  const precision = useSettingStore((state) => state.precision);

  return (
    <React.Fragment>
      <MuiIconButton onClick={handleClickOpen}>
        <SettingsIcon fontSize="inherit" />
      </MuiIconButton>
      <DialogBox
        title="Setting"
        open={open}
        onOk={handleClose}
        onCancel={handleClose}
      >
        <Box
          noValidate
          component="form"
          sx={{
            display: 'flex',
            width: '100%',
            flexDirection: 'column',
            m: 'auto',
          }}
        >
          <SettingItem label="Float precision">
            <OutlinedInput
              sx={{ ml: 1, flex: 1, height: 32 }}
              placeholder={`${precision}`}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                setStore({
                  precision: parseInt(event.target.value),
                });
              }}
            />
          </SettingItem>
        </Box>
      </DialogBox>
    </React.Fragment>
  );
}
