import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Typography } from "@mui/material";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { TreeView, TreeViewProps } from "@mui/x-tree-view/TreeView";
import { IconFile, IconFolder, IconFolderOpen } from "@tabler/icons-react";
import * as React from "react";

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
}

export interface FileTreeProps extends TreeViewProps<undefined> {
  data: FileNode[];
}

export default function FileTree({
  data,
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
          <IconFile />
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
      defaultExpanded={data?.map((item) => item.path) ?? []}
      defaultExpandIcon={<ChevronRightIcon />}
      onNodeSelect={onNodeSelect}
      onNodeToggle={handleToggle}
      expanded={expanded}
      {...rest}
    >
      {data?.map((item) => renderTree(item))}
    </TreeView>
  );
}
