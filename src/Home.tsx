import Dataset from "@/components/Dataset";
import { FileTab, FileTabs } from "@/components/FileTabs";
import FileTreeView from "@/components/FileTree";
import { Content, Layout, Sidebar } from "@/components/Layout";
import { SideToolbar } from "@/components/SideToolbar";
import { FileNode, useDBStore } from "@/stores/db";
import { DTableType, useStore } from "@/stores/store";
import { useTabsStore } from "@/stores/tabs";
import { isDarkTheme } from "@/utils";

import { Box, BoxProps } from "@mui/material";
import { styled } from "@mui/material/styles";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/primitives";
import { useEffect, useState } from "react";

export const DatasetEmpty = styled((props) => <Box {...props} />)<BoxProps>(
  ({}) => ({
    display: "flex",
    marginTop: "20%",
    height: "100%",
    justifyContent: "center",
  })
);

function Home() {
  const [selectedTable, setSelectedTable] = useState<DTableType | null>(null);
  const dbList = useDBStore((state) => state.dbList);
  const appendDB = useDBStore((state) => state.append);
  const tabs = useTabsStore((state) => state.tabs);
  const curTab = useTabsStore((state) => state.current);
  const activateTab = useTabsStore((state) => state.active);

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
  const table = useStore((state) => state.table);

  const [value, setValue] = useState(0);
  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    console.log("newValue:", newValue);
    activateTab(tabs[newValue]);
    setValue(newValue);
  };
  return (
    <Layout>
      <Sidebar>
        <SideToolbar />
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
        </TreeViewWrapper>
      </Sidebar>
      <Content>
        {!!table?.tableName ? (
          <>
            <FileTabs value={value} onChange={handleChange}>
              {tabs.map((tab, i) => {
                return <FileTab key={i} label={tab?.tableName} value={i} />;
              })}
            </FileTabs>
            <Dataset />
          </>
        ) : (
          <DatasetEmpty />
        )}
      </Content>
    </Layout>
  );
}

const TreeViewWrapper = styled(Box)<BoxProps>(({ theme }) => ({
  width: "100%",
  maxHeight: "calc(100vh - 64px)",
  height: "calc(100vh - 64px)",
  overflow: "auto",
  pr: 1,
  pb: 2,
  borderRight: isDarkTheme(theme) ? "1px solid #1e1f22" : "1px solid #e2e2e2",
}));

export default Home;
