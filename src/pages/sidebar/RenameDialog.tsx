import TextField from '@mui/material/TextField';
import { useAtom, useAtomValue } from 'jotai';
import { useState } from 'react';

import { DialogBox } from '@/components/DialogBox';
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
    <DialogBox
      title="Rename"
      open={context != null}
      onOk={handleSubmit}
      onCancel={handClose}
    >
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
    </DialogBox>
  );
}
