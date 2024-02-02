import { default as AccountTreeIcon } from '@mui/icons-material/AccountTree';
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
import { useAtom } from 'jotai';
import { useState } from 'react';

import { ClickhouseIcon, DuckdbIcon } from '@/components/custom/Icons';
import {
  DBType,
  NodeContextType,
  contextMenuAtom,
  selectedNodeAtom,
  useDBListStore,
} from '@/stores/dbList';
import { TableContextType, useTabsStore } from '@/stores/tabs';
import { TreeNode } from '@/types';

import { DBTreeItem, TreeItemLabel } from './DBTreeItem';

export const getTypeIcon = (type: string, expanded: boolean) => {
  if (type == 'path' && expanded) {
    return <IconFolderOpen />;
  }
  if (type == 'path' && !expanded) {
    return <IconFolder />;
  }
  if (type == 'root') {
    return <IconDatabase />;
  }
  if (type == 'clickhouse') {
    return <ClickhouseIcon />;
  }
  if (type == 'duckdb') {
    return <DuckdbIcon />;
  }
  if (type == 'database') {
    return <AccountTreeIcon />;
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
}

export default function DBTreeView({ db, ...rest }: DBTreeViewProps) {
  const updateTab = useTabsStore((state) => state.update);
  const dbTableMap = useDBListStore((state) => state.tables);

  const [contextMenu, setContextMenu] = useAtom(contextMenuAtom);

  const handleContextMenu = (
    event: React.MouseEvent,
    context: NodeContextType,
  ) => {
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

  const renderTree = (node: TreeNode, isRoot = false) => (
    <DBTreeItem
      key={node.path}
      nodeId={node.path}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const context = {
          dbId: db.id,
          tableId: node.path,
          id: `${db.id}:${node.path}`,
        };
        // root path context menu
        if (node.path == db.data.path) {
          handleContextMenu(event, context);
        }
        // TODO: other
      }}
      label={
        <TreeItemLabel
          nodeId={node.path}
          node={isRoot ? { ...node, name: db.displayName ?? node.name } : node}
          icon={
            isRoot && ['clickhouse', 'duckdb'].indexOf(db.dialect) > -1
              ? db.dialect
              : node.type ?? 'file'
          }
        />
      }
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

  const [selectedNode, setSelectedNode] = useAtom(selectedNodeAtom);
  const selected = selectedNode?.dbId == db.id ? selectedNode.tableId : null;
  return (
    <TreeView
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      onNodeSelect={(_, nodeIds) => {
        const nodes = dbTableMap.get(db.id)!;
        const node = nodes.get(nodeIds as string);

        const nodeContext = {
          dbId: db.id,
          tableId: nodeIds as string,
        };

        setSelectedNode(nodeContext);

        const noDataTypes = ['path', 'database', 'root'];
        if (node && !noDataTypes.includes(node.type ?? '')) {
          const item: TableContextType = {
            ...nodeContext,
            id: `${db.id}:${nodeIds}`,
            dbId: db.id,
            displayName: node?.name as string,
          };
          updateTab!(item);
        }
      }}
      onNodeToggle={handleToggle}
      expanded={expanded}
      selected={selected}
      sx={{ position: 'relative' }}
      {...rest}
    >
      {renderTree(db.data, true)}
    </TreeView>
  );
}
