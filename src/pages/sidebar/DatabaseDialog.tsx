import DialogContentText from '@mui/material/DialogContentText';
import TextField from '@mui/material/TextField';
import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';

import { DialogBox } from '@/components/DialogBox';
import { configAtom, dbMapAtom, useDBListStore } from '@/stores/dbList';

export default function DatabaseDialog() {
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
    <DialogBox
      title={db?.displayName ?? db?.id ?? ''}
      open={context != null}
      onOk={handleSubmit}
      onCancel={handClose}
    >
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
    </DialogBox>
  );
}
