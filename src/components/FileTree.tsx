import { DTableType, useStore } from "@/stores/store";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Typography } from "@mui/material";
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

  const renderTree = (node: FileNode) => (
    <TreeItem
      key={node.path}
      nodeId={node.path}
      label={
        <Typography
          sx={{
            fontWeight: "inherit",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.name}
        </Typography>
      }
      icon={
        !node.is_dir ? (
          getFileTypeIcon(node?.type ?? node.path.split(".")[1])
        ) : expanded.includes(node.path) ? (
          <IconFolderOpen />
        ) : (
          <IconFolder />
        )
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
      aria-label="file tree"
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
          setStore!({
            page: 1,
            perPage: 500,
            table: item,
            orderBy: undefined,
            sqlWhere: undefined,
          });
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
