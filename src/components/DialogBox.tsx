import CloseIcon from '@mui/icons-material/Close';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogProps,
  DialogTitle,
  IconButton,
  Stack,
  styled,
} from '@mui/material';

export interface DialogBoxProps extends DialogProps {
  title: string;
  onOk: () => void;
  onCancel: () => void;
}

export const DialogBox = styled(
  ({ title, onCancel, onOk, ...props }: DialogBoxProps) => (
    <Dialog
      aria-labelledby="draggable-dialog-title"
      onClose={(_, reason) => {
        if (reason != 'backdropClick') {
          onCancel();
        }
      }}
      {...props}
    >
      <DialogTitle minWidth={600} sx={{}}>
        <Stack
          direction="row"
          justifyContent={'space-between'}
          alignItems={'center'}
        >
          {title}
          <IconButton aria-label="close" onClick={onCancel}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>{props.children}</DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" onClick={onOk}>
          Ok
        </Button>
      </DialogActions>
    </Dialog>
  ),
)(({ theme }) => ({
  '& .MuiDialogTitle-root': {
    fontSize: 14,
    paddingTop: 4,
    paddingBottom: 4,
  },
}));
