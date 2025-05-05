import { Parser } from '@/ast';
import { Node } from 'web-tree-sitter';

type TableType = {
  table?: string | null;
  alias?: string | null;
};

export function get_tables(
  parser: Parser,
  from_caluse: Node | null,
): TableType[] {
  if (!from_caluse) {
    return [];
  }
  const source = `
  (
      (relation
        (object_reference) @table
        (_)*
        alias: (identifier)? @alias_name 
      ) @relation
    )
  `;
  const query = parser.query(source);
  const captures = query.captures(from_caluse);
  let currentRelation: TableType = {};
  const results = [];
  for (const { name, node } of captures) {
    switch (name) {
      case 'relation':
        currentRelation = { table: null, alias: null };
        results.push(currentRelation);
        break;
      case 'table':
        currentRelation.table = node.text;
        break;
      case 'alias_name':
        currentRelation.alias = node.text;
        break;
    }
  }
  return results;
}

export function insertUnderscore(text: string, offset: number): string {
  return text.slice(0, offset) + '_' + text.slice(offset);
}

export function analyzeContext(parser: Parser, sql: string, position: number) {
  const tree = parser.parse(sql);
  const rootNode = tree?.rootNode;
  if (!rootNode) {
    return null;
  }
  let _node = rootNode.descendantForIndex(position, position);
  let leafNode = _node;
  console.log('leafNode:', leafNode?.toString(), formatPosition(leafNode));

  while (leafNode) {
    if (leafNode.type == 'join_condition') {
      const stmtNode = findParentNode(leafNode);
      const tables = get_tables(parser, stmtNode);
      if (sql[position - 1] == '.') {
        const _table = _node?.previousNamedSibling?.text;
        return {
          type: 'join_condition',
          scope: 'column',
          tables: filterTable(_table, tables),
        };
      }
      return {
        type: 'join_condition',
        scope: 'table',
        tables,
      };
    }
    if (leafNode.type == 'from') {
      return {
        type: 'from',
        scope: 'table',
      };
    }
    if (leafNode.type == 'select') {
      const tables = get_tables(parser, leafNode.nextSibling);
      if (sql[position - 1] == '.') {
        const _table = _node?.previousNamedSibling?.text;
        return {
          type: 'select',
          scope: 'column',
          tables: filterTable(_table, tables),
        };
      }
      return {
        type: 'select',
        scope: 'column',
        tables,
      };
    }

    leafNode = leafNode.parent;
  }

  // Analyze the context at the given position
}

function findParentNode(startNode: Node, type = 'statement') {
  let currentNode = startNode.parent; // 从父节点开始查找

  while (currentNode) {
    if (currentNode.type == type) {
      return currentNode;
    }
    // 继续向上查找
    currentNode = currentNode.parent;
  }

  // 遍历到根节点仍未找到
  return null;
}

export function formatPosition(node: Node | null) {
  if (!node) {
    return '[]';
  }
  const start = `[${node.startPosition.row}, ${node.startPosition.column}]`;
  const end = `[${node.endPosition.row}, ${node.endPosition.column}]`;
  return `${start} - ${end}`;
}

export function filterTable(_table: string | undefined, tables: TableType[]) {
  return tables.filter((t) => t.table == _table || t.alias == _table);
}
