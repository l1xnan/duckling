import { DTableType, useStore } from "@/stores/store";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Typography } from "@mui/material";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { TreeView, TreeViewProps } from "@mui/x-tree-view/TreeView";
import {
  IconBorderOuter,
  IconDatabase,
  IconFile,
  IconFilePower,
  IconFileTypeCsv,
  IconFileTypeXls,
  IconFolder,
  IconFolderOpen,
  IconTable,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { DBType, FileNode } from "@/stores/db";
import { useTabsStore } from "@/stores/tabs";

export function flattenTree(fileNode: FileNode, map: Map<string, FileNode>) {
  map.set(fileNode.path, fileNode);

  fileNode?.children?.forEach((child) => {
    flattenTree(child, map);
  });
}

const getFileTypeIcon = (type: string) => {
  if (type == "duckdb") {
    return <IconDatabase />;
  }
  if (type == "table") {
    return <IconTable />;
  }
  if (type == "view") {
    return <IconBorderOuter />;
  }
  if (type == "csv") {
    return <IconFileTypeCsv />;
  }
  if (type == "xlsx") {
    return <IconFileTypeXls />;
  }
  if (type == "parquet") {
    return <IconFilePower />;
  }
  return <IconFile />;
};

export interface FileTreeProps extends TreeViewProps<boolean> {
  rootKey: number;
  db: DBType;
  onSelectTable: (item: DTableType) => void;
}

export default function FileTree({
  rootKey,
  db,
  selected,
  onSelectTable,
  ...rest
}: FileTreeProps) {
  const data = db.data;

  const fileMap = useMemo(() => {
    let fileMap = new Map();
    flattenTree(data, fileMap);
    return fileMap;
  }, [rootKey, db]);
  const setStore = useStore((state) => state.setStore);
  const appendTab = useTabsStore((state) => state.append);
  const updateTab = useTabsStore((state) => state.update);
  const tabs = useTabsStore((state) => state.tabs);

  const renderTree = (node: FileNode) => (
    <TreeItem
      key={node.path}
      nodeId={node.path}
      label={
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            p: 0,
            pt: 0.5,
            pb: 0.5,
            fontSize: "12px",
            height: "24px",
          }}
        >
          <Box
            color="inherit"
            sx={{
              mr: 1,
              display: "flex",
              alignItems: "center",
              height: "100%",
              "& svg": {
                fontSize: "16px",
                height: "16px",
                width: "16px",
              },
            }}
          >
            {!node.is_dir ? (
              getFileTypeIcon(node?.type ?? node.path.split(".")[1])
            ) : expanded.includes(node.path) ? (
              <IconFolderOpen />
            ) : (
              <IconFolder />
            )}
          </Box>

          <Typography
            sx={{
              fontWeight: "inherit",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {node.name}
          </Typography>
        </Box>
      }
    >
      {Array.isArray(node.children)
        ? node.children.map((node) => renderTree(node))
        : null}
    </TreeItem>
  );

  const [expanded, setExpanded] = useState<string[]>([]);
  const handleToggle = (_: React.SyntheticEvent, nodeIds: string[]) => {
    setExpanded(nodeIds);
  };

  return (
    <TreeView
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      onNodeSelect={(_, nodeIds) => {
        const node = fileMap.get(nodeIds);
        let item = {
          rootKey,
          root: data.path,
          tableName: nodeIds as string,
          cwd: db.cwd,
        };
        onSelectTable(item);
        if (node && !node?.is_dir && !node.path.endsWith(".duckdb")) {
          const tab = {
            page: 1,
            perPage: 500,
            table: item,
            orderBy: undefined,
            sqlWhere: undefined,
          };
          setStore!(tab);

          updateTab!(item);
        }
      }}
      onNodeToggle={handleToggle}
      expanded={expanded}
      selected={selected}
      {...rest}
    >
      {renderTree(data)}
    </TreeView>
  );
}
