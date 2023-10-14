import { Button } from "@mui/material";
import * as dialog from "@tauri-apps/plugin-dialog";

export default function DialogButton() {
  return (
    <Button
      onClick={async () => {
        const res = await dialog.open({
          directory: true,
        });
        if (res) {
          // openDirectory(res);
        }
      }}
    >
      Open
    </Button>
  );
}
