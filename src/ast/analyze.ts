import { Parser } from '@/ast';
import { Node } from 'web-tree-sitter';

/**
 * 表示 SQL 解析器在光标位置识别出的上下文类型。
 */
export enum ContextType {
  /** 未知或不明确的上下文 */
  UNKNOWN = 'UNKNOWN',

  /** 预期输入数据库名称 */
  DATABASE = 'DATABASE',

  /** 预期输入模式名称 (如果数据库支持) */
  SCHEMA = 'SCHEMA',

  /** 预期输入表名称 */
  TABLE = 'TABLE',

  /** 预期输入视图名称 */
  VIEW = 'VIEW', // 类似于表

  /** 预期输入列名称 */
  COLUMN = 'COLUMN',

  /** 预期输入函数名称 */
  FUNCTION = 'FUNCTION',

  /** 预期输入关键字 (SELECT, FROM, WHERE 等) */
  KEYWORD = 'KEYWORD',

  /** 预期输入别名 (通常在 AS 后面) */
  ALIAS_TABLE = 'ALIAS_TABLE', // 用于表别名
  ALIAS_COLUMN = 'ALIAS_COLUMN', // 用于列别名

  // 可以根据需要扩展更多类型, 例如 PROCEDURE, TRIGGER, INDEX 等
}

export type CompleteMetaType = {
  prefixCode?: string;
  tables?: Record<string, Record<string, { name: string, type: string }[]>>;
  keywords?: string[];
  functions?: string[];
  operators?: string[];
};

type TableType = {
  table_reference?: string | null;
  database?: string;
  schema?: string | null;
  name?: string | null;
  alias?: string | null;
};

export type SqlContext = {
  type: ContextType;
  stmt: string;

  database?: string;
  tablesInScope?: TableType[];
};

export type SuggestionType = {
  type: ContextType;
  label: string;
  insertText?: string;
  detail?: string;
};

export function get_tables(
  parser: Parser,
  from_clause: Node | null,
): TableType[] {
  if (!from_clause) {
    return [];
  }
  const source = `
  (
    (relation
      (object_reference
        database: (identifier)? @database
        schema: (identifier)? @schema
        name: (identifier)? @name
      ) @table
      (_)*
      alias: (identifier)? @alias_name
    ) @relation
  )
  `;
  const query = parser.query(source);
  const captures = query.captures(from_clause);
  let currentRelation: TableType = {};
  const results = [];
  for (const { name, node } of captures) {
    switch (name) {
      case 'relation':
        currentRelation = { table_reference: null, alias: null };
        results.push(currentRelation);
        break;
      case 'table':
        currentRelation.table_reference = node.text;
        break;
      case 'database':
        currentRelation.database = node.text;
        break;
      case 'schema':
        currentRelation.schema = node.text;
        break;
      case 'name':
        currentRelation.name = node.text;
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

export function analyzeContext(
  parser: Parser,
  sql: string,
  position: number,
): SqlContext | null {
  const tree = parser.parse(sql);
  const rootNode = tree?.rootNode;
  if (!rootNode) {
    return null;
  }
  const _node = rootNode.descendantForIndex(position, position);
  let leafNode = _node;
  console.log('leafNode:', leafNode?.toString(), formatPosition(leafNode));

  while (leafNode) {
    if (leafNode.type == 'join_condition') {
      const stmtNode = findParentNode(leafNode);
      const tables = get_tables(parser, stmtNode);
      if (sql[position - 1] == '.') {
        const _table = _node?.previousNamedSibling?.text;
        return {
          stmt: 'join_condition',
          type: ContextType.COLUMN,
          tablesInScope: filterTable(_table, tables),
        };
      }
      return {
        stmt: 'join_condition',
        type: ContextType.TABLE,
        tablesInScope: tables,
      };
    }
    if (leafNode.type == 'from') {
      if (sql[position - 1] == '.') {
        const _db = _node?.previousNamedSibling?.text;
        return {
          stmt: 'from',
          type: ContextType.TABLE,
          database: _db,
        };
      }
      return {
        stmt: 'from',
        type: ContextType.TABLE,
      };
    }
    if (leafNode.type == 'select') {
      const tables = get_tables(parser, leafNode.nextSibling);
      if (sql[position - 1] == '.') {
        const _table = _node?.previousNamedSibling?.text;
        return {
          stmt: 'select',
          type: ContextType.COLUMN,
          tablesInScope: filterTable(_table, tables),
        };
      }
      return {
        stmt: 'select',
        type: ContextType.COLUMN,
        tablesInScope: tables,
      };
    }

    if (leafNode.type == 'where') {
      const tables = get_tables(parser, leafNode.previousSibling);
      if (sql[position - 1] == '.') {
        const _table = _node?.previousNamedSibling?.text;
        return {
          stmt: 'select',
          type: ContextType.COLUMN,
          tablesInScope: filterTable(_table, tables),
        };
      }
      return {
        stmt: 'where',
        type: ContextType.COLUMN,
        tablesInScope: tables,
      };
    }

    leafNode = leafNode.parent;
  }
  return null;
  // Analyze the context at the given position
}

export function makeSuggestions(ctx: SqlContext, meta: CompleteMetaType) {
  const { tables: tableSchema } = meta;
  if (!tableSchema) {
    return [];
  }

  console.log('SqlContext:', ctx);

  const suggestions: SuggestionType[] = [];
  if (ctx?.type === ContextType.TABLE) {
    Object.entries(tableSchema).forEach(([db, tables]) => {
      Object.keys(tables).forEach((tbl) => {
        const label =
          db.length == 0
            ? normalize(tbl)
            : `${normalize(db)}.${normalize(tbl)}`;
        suggestions.push({
          label: label,
          type: ContextType.TABLE,
          insertText: label,
        });
      });
    });
  } else if (ctx?.type === ContextType.COLUMN) {
    const columns: { name: string; type: string }[] = [];
    ctx.tablesInScope?.forEach((table) => {
      if (table.name) {
        columns.push(...tableSchema['']?.[table.name ?? ''] ?? []);
      }

      if (table.schema && table.name) {
        columns.push(...tableSchema[table.schema]?.[table.name] ?? []);
      }
    });

    suggestions.push(
      ...columns.map(({ name, type }) => {
        return {
          label: name,
          type: ContextType.COLUMN,
          insertText: normalize(name),
          detail: type,
        };
      }),
    );
  } else if (ctx?.type === ContextType.KEYWORD) {
    //
  } else if (ctx?.type === ContextType.FUNCTION) {
    //
  } else if (ctx?.type === ContextType.DATABASE) {
    //
  }

  console.log('suggestionsRaw', suggestions);
  return suggestions;
}

export const normalize = (name: string) =>
  /\s/.test(name) ? `\`${name}\`` : name;

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
  return tables.filter((t) => t.name == _table || t.alias == _table);
}

/**
 * 递归地将 SyntaxNode 及其子节点格式化为带缩进的字符串。
 *
 * @param node - 要格式化的节点。
 * @param options - 配置选项。
 * @param [options.includeAnonymous=false] 是否包含匿名节点 (如标点符号)。默认为 false，只显示命名节点。
 * @param [options.includeText=false] 是否在每行末尾包含节点的文本内容 (可能会截断)。默认为 false。
 * @param [options.maxTextLength=30] 如果 includeText 为 true，节点文本的最大显示长度。
 * @returns {string} 格式化后的字符串树。
 */
export function formatNodeTree(
  node: Node,
  { includeAnonymous = false, includeText = false, maxTextLength = 30 } = {},
): string {
  if (!node) {
    return '<null node>';
  }

  // 内部递归函数
  function _recursiveToString(
    currentNode: Node,
    indentLevel: number,
    prefix: string,
  ) {
    const indent = '  '.repeat(indentLevel); // 每层缩进2个空格

    const position = formatPosition(currentNode);

    let textSuffix = '';
    if (includeText) {
      let text = currentNode.text.replace(/\s+/g, ' '); // 将连续空白替换为单个空格
      if (text.length > maxTextLength) {
        text = text.substring(0, maxTextLength) + '...';
      }
      textSuffix = `  "${text}"`; // 在末尾添加文本预览
    }
    // 格式化当前节点行: 缩进 + 前缀(字段名) + 类型 + 范围 [+ 文本]
    let result = `${indent}${prefix}${currentNode.type} ${position}${textSuffix}\n`;

    // 选择要遍历的子节点：命名节点或所有节点
    const children = includeAnonymous
      ? currentNode.children
      : currentNode.namedChildren;
    // 递归处理子节点
    children.forEach((child, childIndex) => {
      // 获取子节点相对于父节点的字段名（如果有）
      const fieldName = currentNode.fieldNameForChild(childIndex);
      const childPrefix = fieldName ? `${fieldName}: ` : ''; // 如果有字段名，作为前缀
      // 递归调用，增加缩进级别
      result += _recursiveToString(child!, indentLevel + 1, childPrefix);
    });
    return result;
  }

  // 启动递归，初始缩进为0，无前缀
  return _recursiveToString(node, 0, '');
}
