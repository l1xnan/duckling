import { Tooltip } from '@/components/custom/tooltip';
import { DBType, selectedNodeAtom, tablesAtom } from '@/stores/dbList';
import { TableContextType, useTabsStore } from '@/stores/tabs';
import { TreeNode } from '@/types';
import { filterTree, isEmpty } from '@/utils';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { TreeView, TreeViewProps } from '@mui/x-tree-view/TreeView';
import { useAtom, useAtomValue } from 'jotai';
import { useState } from 'react';

import { TreeItem, TreeItemLabel } from '../../components/TreeItem.tsx';
import { ConnectionContextMenu } from './context-menu/ConnectionContextMenu';
import { SchemaContextMenu } from './context-menu/SchemaContextMenu';
import { TableContextMenu } from './context-menu/TableContextMenu';

export interface DBTreeViewProps extends TreeViewProps<boolean> {
  db: DBType;
  filter?: string;
}

export default function DBTreeView({ db, filter, ...rest }: DBTreeViewProps) {
  const updateTab = useTabsStore((state) => state.update);
  const dbTableMap = useAtomValue(tablesAtom);
  const renderTree = (node: TreeNode, isRoot = false) => {
    if (
      ['parquet', 'csv', 'view', 'table'].includes(node.type as string) &&
      !isEmpty(filter) &&
      !node.path.includes(filter as string)
    ) {
      return null;
    }
    const label = (
      <TreeItemLabel
        nodeId={node.path}
        node={isRoot ? { ...node, name: db.displayName ?? node.name } : node}
        icon={isRoot ? db.dialect : node.type ?? 'file'}
      />
    );

    const isDummy = node.type == 'path' && db.dialect != 'folder';
    const child = isDummy ? (
      <div className="truncate">{label}</div>
    ) : (
      <Tooltip title={node.path}>
        <div className="truncate">{label}</div>
      </Tooltip>
    );
    return (
      <TreeItem
        key={node.path}
        nodeId={node.path}
        label={
          isRoot ? (
            <ConnectionContextMenu db={db}>{child}</ConnectionContextMenu>
          ) : node.type == 'database' ? (
            <SchemaContextMenu db={db} node={node}>
              {child}
            </SchemaContextMenu>
          ) : !isDummy ? (
            <TableContextMenu db={db} node={node}>
              {child}
            </TableContextMenu>
          ) : (
            child
          )
        }
      >
        {Array.isArray(node.children) && node.children.length > 0
          ? node.children.map((node) => renderTree(node))
          : null}
      </TreeItem>
    );
  };

  const [expanded, setExpanded] = useState<string[]>([]);
  const handleToggle = (_: React.SyntheticEvent, nodeIds: string[]) => {
    setExpanded(nodeIds);
  };

  const [selectedNode, setSelectedNode] = useAtom(selectedNodeAtom);
  const selected = selectedNode?.dbId == db.id ? selectedNode.tableId : null;

  const handleNodeSelect: TreeViewProps<boolean>['onNodeSelect'] = (
    _,
    nodeIds,
  ) => {
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
        type: 'table',
      };

      console.log('item', item);
      updateTab!(item);
    }
  };

  const data = filterTree(db.data, filter);
  return data ? (
    <TreeView
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      onNodeSelect={handleNodeSelect}
      onNodeToggle={handleToggle}
      expanded={expanded}
      selected={selected}
      sx={{ position: 'relative' }}
      {...rest}
    >
      {renderTree(data, true)}
    </TreeView>
  ) : null;
}
