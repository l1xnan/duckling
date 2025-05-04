import { Node } from 'web-tree-sitter';
import { Parser } from '.';

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
  let leafNode = rootNode.descendantForIndex(position, position);
  while (leafNode) {
    if (leafNode.type == 'from') {
      return {
        type: 'from',
      };
    }
    if (leafNode.type == 'select') {
      const tables = get_tables(parser, leafNode.nextSibling);
      return {
        type: 'select',
        tables,
      };
    }
    leafNode = leafNode.parent;
  }

  // Analyze the context at the given position
}
