import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import { IconButton, InputBase, ListItem, ListItemText } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import * as React from 'react';
import { ReactNode } from 'react';

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
      <span>{label}</span>
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
      <Dialog
        open={open}
        onClose={(_, reason) => {
          if (reason != 'backdropClick') {
            handleClose();
          }
        }}
      >
        <DialogTitle minWidth={600} sx={{}}>
          Setting
        </DialogTitle>
        <IconButton aria-label="close" onClick={handleClose}>
          <CloseIcon />
        </IconButton>
        <DialogContent dividers>
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
              <InputBase
                sx={{ ml: 1, flex: 1 }}
                placeholder={`${precision}`}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  setStore({
                    precision: parseInt(event.target.value),
                  });
                }}
              />
            </SettingItem>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}
