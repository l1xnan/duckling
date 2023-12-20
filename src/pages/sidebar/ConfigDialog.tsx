import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';

import { configAtom, dbMapAtom, useDBListStore } from '@/stores/dbList';

export default function ConfigDialog() {
  const updateCwd = useDBListStore((state) => state.setCwd);

  const dbMap = useAtomValue(dbMapAtom);

  const [context, setContext] = useAtom(configAtom);
  const dbId = context?.dbId ?? '';
  const db = dbMap.get(dbId);

  const [cwd, setCwd] = useState(db?.cwd ?? '');

  useEffect(() => {
    setCwd(db?.cwd ?? '');
  }, [db?.cwd]);

  const handleSubmit = () => {
    if (dbId) {
      updateCwd(cwd, dbId);
    }
    handClose();
  };

  const handClose = () => {
    setContext(null);
  };

  return (
    <Dialog
      open={context !== null}
      onClose={(_, reason) => {
        if (reason != 'backdropClick') {
          handClose();
        }
      }}
    >
      <DialogTitle>{db?.displayName}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Set working directory for the read parquet relative path
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
        <Button onClick={handleSubmit}>Ok</Button>
        <Button onClick={handClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
