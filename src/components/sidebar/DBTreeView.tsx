import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { TreeView, TreeViewProps } from '@mui/x-tree-view/TreeView';
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
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { DTableType } from '@/stores/dataset';
import { DBType, TreeNode, useDBListStore } from '@/stores/dbList';
import { useTabsStore } from '@/stores/tabs';

import { DBTreeItem, TreeItemLabel } from './DBTreeItem';

export function flattenTree(fileNode: TreeNode, map: Map<string, TreeNode>) {
  map.set(fileNode.path, fileNode);

  fileNode?.children?.forEach((child) => {
    flattenTree(child, map);
  });
}

export const getTypeIcon = (type: string, expanded: boolean) => {
  if (type == 'path' && expanded) {
    return <IconFolderOpen />;
  }
  if (type == 'path' && !expanded) {
    return <IconFolder />;
  }
  if (type == 'duckdb') {
    return <IconDatabase />;
  }
  if (type == 'database') {
    return <IconDatabase />;
  }
  if (type == 'table') {
    return <IconTable />;
  }
  if (type == 'view') {
    return <IconBorderOuter />;
  }
  if (type == 'csv') {
    return <IconFileTypeCsv />;
  }
  if (type == 'xlsx') {
    return <IconFileTypeXls />;
  }
  if (type == 'parquet') {
    return <IconFilePower />;
  }
  return <IconFile />;
};

export interface DBTreeViewProps extends TreeViewProps<boolean> {
  db: DBType;
  onSelectTable: (item: DTableType) => void;
}

export default function DBTreeView({
  db,
  selected,
  onSelectTable,
  ...rest
}: DBTreeViewProps) {
  const data = db.data;

  const fileMap = useMemo(() => {
    const fileMap = new Map();
    flattenTree(data, fileMap);
    return fileMap;
  }, [db.id, db]);
  const updateTab = useTabsStore((state) => state.update);
  const contextMenu = useDBListStore((state) => state.contextMenu);
  const setContextMenu = useDBListStore((state) => state.setContextMenu);

  const handleContextMenu = (event: React.MouseEvent, context: DTableType) => {
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

  const renderTree = (node: TreeNode) => (
    <DBTreeItem
      key={node.path}
      nodeId={node.path}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        // root path context menu
        if (node.path == data.path) {
          const context = {
            root: db.id,
            tableName: node.path as string,
            cwd: db.cwd,
            id: `${db.id}:${node.path}`,
            type: 'editor',
          };
          handleContextMenu(event, context);
        }
        // TODO: other
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
        const item = {
          root: db.id,
          id: `${db.id}:${nodeIds}`,
          tableName: nodeIds as string,
          cwd: db.cwd,
        };
        onSelectTable(item);
        if (node && node.type !== 'path' && !node.path.endsWith('.duckdb')) {
          updateTab!(item);
        }
      }}
      onNodeToggle={handleToggle}
      expanded={expanded}
      selected={selected}
      sx={{ position: 'relative' }}
      {...rest}
    >
      {renderTree(data)}
    </TreeView>
  );
}
