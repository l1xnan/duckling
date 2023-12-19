import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useEffect, useState } from 'react';
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

export const useDBConfigStore = create<FormDialogType>((set) => ({
  open: false,
  db: undefined,
  setOpen: (open: boolean) => set((_) => ({ open })),
  onOpen: () => set((_) => ({ open: true })),
  onClose: () => set((_) => ({ open: false })),
  setDB: (db: TabContextType) => set((_) => ({ db })),
}));

export default function FormDialog() {
  const open = useDBConfigStore((state) => state.open);
  const db = useDBConfigStore((state) => state.db);
  const onClose = useDBConfigStore((state) => state.onClose);
  const updateCwd = useDBListStore((state) => state.setCwd);

  const [cwd, setCwd] = useState(db?.cwd ?? '');

  useEffect(() => {
    setCwd(db?.cwd ?? '');
  }, [db?.cwd]);

  const handleSubmit = () => {
    if (db?.root) {
      updateCwd(cwd, db.root);
    }
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{db?.root.split('/').at(-1)}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Set DuckDB working directory for the read parquet relative path
        </DialogContentText>
        <TextField
          autoFocus
          margin="dense"
          id="cwd"
          label="Working Directory"
          type="text"
          fullWidth
          variant="standard"
          value={cwd}
          onChange={(e) => {
            setCwd(e.target.value);
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit}>Ok</Button>
      </DialogActions>
    </Dialog>
  );
}
