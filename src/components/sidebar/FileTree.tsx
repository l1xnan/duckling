import { DTableType } from "@/stores/store";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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

import { DBType, FileNode, useDBStore } from "@/stores/db";
import { useTabsStore } from "@/stores/tabs";
import { DBTreeItem, TreeItemLabel } from "./DBTreeItem";

export function flattenTree(fileNode: FileNode, map: Map<string, FileNode>) {
  map.set(fileNode.path, fileNode);

  fileNode?.children?.forEach((child) => {
    flattenTree(child, map);
  });
}

export const getTypeIcon = (type: string) => {
  if (type == "folder-open") {
    return <IconFolderOpen />;
  }
  if (type == "folder") {
    return <IconFolder />;
  }
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
  const updateTab = useTabsStore((state) => state.update);
  const contextMenu = useDBStore((state) => state.contextMenu);
  const setContextMenu = useDBStore((state) => state.setContextMenu);

  const handleContextMenu = (event: React.MouseEvent, context: DTableType) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
            context,
          }
        : null,
    );
  };

  const renderTree = (node: FileNode) => (
    <DBTreeItem
      key={node.path}
      nodeId={node.path}
      onContextMenu={(event) => {
        const context = {
          rootKey,
          root: data.path,
          tableName: node.path as string,
          cwd: db.cwd,
          id: `${rootKey}:${node.path}`,
          type: "editor",
        };

        handleContextMenu(event, context);
      }}
      label={<TreeItemLabel nodeId={node.path} node={node} />}
    >
      {Array.isArray(node.children) && node.children.length > 0
        ? node.children.map((node) => renderTree(node))
        : null}
    </DBTreeItem>
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
          id: `${rootKey}:${nodeIds}`,
        };
        onSelectTable(item);
        if (node && !node?.is_dir && !node.path.endsWith(".duckdb")) {
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
