import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

import { create } from "zustand";
import { useState } from "react";
import { DTableType } from "@/stores/store";

type FormDialogType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onOpen: () => void;
  onClose: () => void;
};

export const useDBConfigStore = create<FormDialogType>((set) => ({
  open: false,
  setOpen: (open: boolean) => set((_) => ({ open })),
  onOpen: () => set((_) => ({ open: true })),
  onClose: () => set((_) => ({ open: false })),
}));

export default function FormDialog({ db }: { db: DTableType }) {
  const open = useDBConfigStore((state) => state.open);
  const onClose = useDBConfigStore((state) => state.onClose);

  const [cwd, setCwd] = useState("");

  const handleSubmit = () => {
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>DuckDB</DialogTitle>
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
