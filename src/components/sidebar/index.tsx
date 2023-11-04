import FileTreeView from "@/components/sidebar/FileTree";
import { SideToolbar } from "@/components/SideToolbar";
import { FileNode, useDBStore } from "@/stores/db";
import { DTableType } from "@/stores/store";

import { Box, BoxProps, Divider, ListItemText } from "@mui/material";
import { styled } from "@mui/material/styles";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/primitives";
import { useEffect, useState } from "react";
import { ContextMenu, ContextMenuItem } from "@/components/ContextMenu";
import DeleteIcon from "@mui/icons-material/Delete";
import SettingsIcon from "@mui/icons-material/Settings";
import CodeIcon from "@mui/icons-material/Code";
const TreeViewWrapper = styled(Box)<BoxProps>(({}) => ({
  width: "100%",
  maxHeight: "calc(100vh - 64px)",
  height: "calc(100vh - 64px)",
  overflow: "auto",
  pr: 1,
  pb: 2,
}));

function SidebarTree() {
  const [selectedTable, setSelectedTable] = useState<DTableType | null>(null);
  const dbList = useDBStore((state) => state.dbList);
  const appendDB = useDBStore((state) => state.append);

  async function openDirectory(name?: string) {
    const fileTree: FileNode = await invoke("get_folder_tree", { name });
    if (!!fileTree) {
      appendDB({
        data: fileTree,
      });
    }
  }
  async function openUrl() {
    const path: string = await invoke("opened_urls");
    console.log(path);
  }

  useEffect(() => {
    openUrl();
    const unlisten = listen("open-directory", (e) => {
      console.log(e.payload);

      openDirectory(e.payload as string);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);


  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
          }
        : null
    );
  };

  const handleClose = () => {
    setContextMenu(null);
  };
  return (
    <>
      <SideToolbar selectedTable={selectedTable} />
      <TreeViewWrapper>
        {dbList.map((db, i) => (
          <FileTreeView
            key={i}
            rootKey={i}
            db={db}
            selected={
              selectedTable?.rootKey == i ? selectedTable.tableName : null
            }
            onSelectTable={setSelectedTable}
          />
        ))}
        <ContextMenu
          open={contextMenu !== null}
          onClose={handleClose}
          anchorReference="anchorPosition"
          anchorPosition={
            contextMenu !== null
              ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
              : undefined
          }
        >
          <ContextMenuItem onClick={() => {}} icon={<SettingsIcon />}>
            <ListItemText>Properties</ListItemText>
          </ContextMenuItem>
          <ContextMenuItem icon={<CodeIcon />} onClick={() => {}}>
            Query Editor
          </ContextMenuItem>
          <Divider />
          <ContextMenuItem
            icon={<DeleteIcon />}
            onClick={() => {
              handleClose();
            }}
          >
            <ListItemText> Remove Data Source...</ListItemText>
          </ContextMenuItem>
        </ContextMenu>
      </TreeViewWrapper>
    </>
  );
}

export default SidebarTree;
