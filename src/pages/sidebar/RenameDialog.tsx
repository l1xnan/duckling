import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useAtom, useAtomValue } from 'jotai';
import { useState } from 'react';

import { dbMapAtom, renameAtom, useDBListStore } from '@/stores/dbList';

// rename db
export default function RenameDialog() {
  const rename = useDBListStore((s) => s.rename);
  const dbMap = useAtomValue(dbMapAtom);

  const [context, setContext] = useAtom(renameAtom);
  const dbId = context?.dbId ?? '';
  const db = dbMap.get(dbId);

  const initDisplayName = db?.displayName ?? '';

  const [displayName, setDisplayName] = useState<string | undefined>(
    initDisplayName,
  );

  const handClose = () => {
    setContext(null);
  };

  const handleSubmit = () => {
    console.log(dbId, db);
    if (dbId && displayName) {
      rename(dbId, displayName);
    }
    handClose();
  };
  return (
    <Dialog
      aria-labelledby="draggable-dialog-title"
      open={context != null}
      onClose={(_, reason) => {
        if (reason != 'backdropClick') {
          handClose();
        }
      }}
    >
      <DialogTitle>Rename</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Name"
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
        <Button variant="outlined" onClick={handClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit}>
          Ok
        </Button>
      </DialogActions>
    </Dialog>
  );
}
