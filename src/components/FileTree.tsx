import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Typography } from "@mui/material";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { TreeView, TreeViewProps } from "@mui/x-tree-view/TreeView";
import {
  IconDatabase,
  IconFile,
  IconFilePower,
  IconFileTypeCsv,
  IconFileTypeXls,
  IconFolder,
  IconFolderOpen,
  IconTable,
} from "@tabler/icons-react";
import * as React from "react";

export interface FileNode {
  name: string;
  type?: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
}

export interface FileTreeProps extends TreeViewProps<undefined> {
  data: FileNode;
}

const getFileTypeIcon = (type: string) => {
  if (type == "duckdb") {
    return <IconDatabase />;
  }
  if (type == "table") {
    return <IconTable />;
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

export default function FileTree({
  data,
  selected,
  onNodeSelect,
  ...rest
}: FileTreeProps) {
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

  const [expanded, setExpanded] = React.useState<string[]>([]);
  const handleToggle = (_: React.SyntheticEvent, nodeIds: string[]) => {
    setExpanded(nodeIds);
  };
  return (
    <TreeView
      aria-label="file tree"
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      onNodeSelect={onNodeSelect}
      onNodeToggle={handleToggle}
      expanded={expanded}
      selected={selected}
      {...rest}
    >
      {renderTree(data)}
    </TreeView>
  );
}
