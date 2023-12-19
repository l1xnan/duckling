import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { create } from 'zustand';

import { useDBListStore } from '@/stores/dbList';
import { TabContextType } from '@/stores/tabs';

type FormDialogType = {
  open: boolean;
  db?: TabContextType;
  setOpen: (open: boolean) => void;
  setDB: (db: TabContextType) => void;
  onOpen: () => void;
  onClose: () => void;
};

export const useRenameStore = create<FormDialogType>((set) => ({
  open: false,
  db: undefined,
  setOpen: (open: boolean) => set((_) => ({ open })),
  onOpen: () => set((_) => ({ open: true })),
  onClose: () => set((_) => ({ open: false })),
  setDB: (db: TabContextType) => set((_) => ({ db })),
}));

export default function Rename() {
  const open = useRenameStore((state) => state.open);
  const db = useRenameStore((state) => state.db);
  const onClose = useRenameStore((state) => state.onClose);
  const rename = useDBListStore((state) => state.rename);

  const initDisplayName = db?.displayName ?? '';

  const [displayName, setDisplayName] = useState(initDisplayName);
  const handleSubmit = () => {
    if (db?.root) {
      rename(db.root, displayName);
    }
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason != 'backdropClick') {
          onClose();
        }
      }}
    >
      <DialogTitle>Rename</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          id="cwd"
          label="Working Directory"
          type="text"
          fullWidth
          variant="standard"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleSubmit}>Ok</Button>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
