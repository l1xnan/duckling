import SettingsIcon from '@mui/icons-material/Settings';
import {
  Box,
  ListItem,
  ListItemText,
  OutlinedInput,
  OutlinedInputProps,
  styled,
} from '@mui/material';
import * as React from 'react';
import { ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { DialogBox } from '@/components/DialogBox';
import { MuiIconButton } from '@/components/MuiIconButton';
import { SettingState, useSettingStore } from '@/stores/setting';

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

export const FormInput = styled(OutlinedInput)<OutlinedInputProps>(() => ({
  ml: 1,
  flex: 1,
  height: 32,
}));

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
  const table_font_family = useSettingStore((state) => state.table_font_family);
  const { control, handleSubmit } = useForm({
    defaultValues: {
      table_font_family,
      precision,
    },
  });

  const onSubmit = (data: SettingState) => {
    setStore(data);
    console.log(data);
  };

  return (
    <React.Fragment>
      <MuiIconButton onClick={handleClickOpen}>
        <SettingsIcon fontSize="inherit" />
      </MuiIconButton>
      <DialogBox
        title="Setting"
        open={open}
        onOk={() => {
          handleSubmit(onSubmit)();
          handleClose();
        }}
        onCancel={handleClose}
      >
        <Box
          noValidate
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          sx={{
            display: 'flex',
            width: '100%',
            flexDirection: 'column',
            m: 'auto',
          }}
        >
          <SettingItem label="Float precision">
            <Controller
              name="precision"
              control={control}
              render={({ field }) => <FormInput {...field} />}
            />
          </SettingItem>
          <SettingItem label="Table Font Family">
            <Controller
              name="table_font_family"
              control={control}
              render={({ field }) => <FormInput {...field} />}
            />
          </SettingItem>
        </Box>
      </DialogBox>
    </React.Fragment>
  );
}
