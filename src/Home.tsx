import {
  MemoDataset,
  PageProvider,
} from "@/components/Dataset";
import { FileTab, FileTabList, FileTabPanel } from "@/components/FileTabs";
import FileTreeView from "@/components/FileTree";
import { Content, Layout, Sidebar } from "@/components/Layout";
import { SideToolbar } from "@/components/SideToolbar";
import { FileNode, useDBStore } from "@/stores/db";
import { DTableType } from "@/stores/store";
import { useTabsStore } from "@/stores/tabs";
import TabContext from "@mui/lab/TabContext";
import { Panel, PanelGroup } from "react-resizable-panels";

import { Box, BoxProps, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { styled } from "@mui/material/styles";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/primitives";
import { useEffect, useMemo, useState } from "react";
import ResizeHandle from "@/components/ResizeHandle";

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
  const activateTab = useTabsStore((state) => state.active);
  const removeTab = useTabsStore((state) => state.remove);
  const currentTab = useTabsStore((state) => state.table);

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

  const tabList = useMemo(() => {
    return (
      <FileTabList onChange={(_, value) => activateTab(value)}>
        {tabs.map((tab) => {
          return (
            <FileTab
              key={tab.id}
              value={tab.id}
              label={
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Box>{tab?.tableName}</Box>
                  <IconButton
                    size="small"
                    component="div"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTab(tab.id);
                    }}
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </Box>
              }
            />
          );
        })}
      </FileTabList>
    );
  }, [tabs]);

  const items = useMemo(() => {
    return tabs.map((tab) => {
      return (
        <PageProvider key={tab.id} table={tab}>
          <FileTabPanel value={tab.id}>
            <MemoDataset />
          </FileTabPanel>
        </PageProvider>
      );
    });
  }, [tabs]);

  return (
    <Layout>
      <PanelGroup direction="horizontal">
        <Panel defaultSize={30}>
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
        </Panel>
        <ResizeHandle />
        <Panel>
          <Content>
            <TabContext value={currentTab?.id ?? ""}>
              <Box>{tabs?.length > 0 ? tabList : <DatasetEmpty />}</Box>
              <Box>{items}</Box>
            </TabContext>
          </Content>
        </Panel>
      </PanelGroup>
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
}));

export default Home;
