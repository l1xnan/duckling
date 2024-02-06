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
import { useAtom, useAtomValue } from 'jotai';
import { useState } from 'react';

import { ClickhouseIcon, DuckdbIcon } from '@/components/custom/Icons';
import { HtmlTooltip } from '@/components/custom/Tooltip';
import { DBType, selectedNodeAtom, tablesAtom } from '@/stores/dbList';
import { TableContextType, useTabsStore } from '@/stores/tabs';
import { TreeNode } from '@/types';

import { DBTreeItem, TreeItemLabel } from './DBTreeItem';
import { DBContextMenu } from './context-menu/DBContextMenu';
import { TableContextMenu } from './context-menu/TableContextMenu';

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
  const dbTableMap = useAtomValue(tablesAtom);
  const renderTree = (node: TreeNode, isRoot = false) => {
    const label = (
      <TreeItemLabel
        nodeId={node.path}
        node={isRoot ? { ...node, name: db.displayName ?? node.name } : node}
        icon={
          isRoot && ['clickhouse', 'duckdb'].indexOf(db.dialect) > -1
            ? db.dialect
            : node.type ?? 'file'
        }
      />
    );
    return (
      <DBTreeItem
        key={node.path}
        nodeId={node.path}
        label={
          isRoot ? (
            <DBContextMenu db={db}>
              <HtmlTooltip title={node.path}>
                <div className="truncate">{label}</div>
              </HtmlTooltip>
            </DBContextMenu>
          ) : (
            <TableContextMenu node={node}>
              <HtmlTooltip title={node.path}>
                <div className="truncate">{label}</div>
              </HtmlTooltip>
            </TableContextMenu>
          )
        }
      >
        {Array.isArray(node.children) && node.children.length > 0
          ? node.children.map((node) => renderTree(node))
          : null}
      </DBTreeItem>
    );
  };

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
