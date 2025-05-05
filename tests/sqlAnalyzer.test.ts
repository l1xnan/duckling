// tests/sqlAnalyzer.test.js
import _Parser, { Language, Query, SyntaxNode, Tree } from 'tree-sitter';
import { beforeAll, beforeEach, describe, it } from 'vitest';

import { Parser as ParserType } from '@/ast';
import { analyzeContext, formatPosition } from '@/ast/analyze';
import SQL from '@l1xnan/tree-sitter-sql';

export class Parser extends _Parser {
  constructor() {
    super();
  }
  query(source: string) {
    return new Query(SQL as Language, source);
  }
}

// --- Test Data ---

type CurrentContext = {
  sql: string;
  tree: Tree;
  rootNode: SyntaxNode;
  position: number;
};

// --- Test Suite ---
describe('analyzeSqlContext', () => {
  let parser: Parser;
  beforeAll(async () => {
    // const { default: SQL } = await import('@l1xnan/tree-sitter-sql');
    parser = new Parser();
    parser.setLanguage(SQL as Language);
  });

  let current: CurrentContext;

  beforeEach((ctx) => {
    const sql = ctx.task.name;
    const tree = parser.parse(sql);
    const rootNode = tree.rootNode;
    const position = sql.indexOf('_');
    console.log('root:\n', rootNode.toString());
    console.log('root:\n', formatNodeTree(rootNode, { includeText: true }));
    current = {
      sql,
      tree,
      rootNode,
      position,
    };
  });
  // Basic check - Vitest will ensure async tests are handled
  it('select from _', async () => {
    const { sql, position } = current;
    const sqlContext = analyzeContext(
      parser as unknown as ParserType,
      sql,
      position,
    );
    console.log('sqlContext:', sqlContext);
  });
  it('select * from _', async () => {
    const { sql, position } = current;
    const sqlContext = analyzeContext(
      parser as unknown as ParserType,
      sql,
      position,
    );
    console.log('sqlContext:', sqlContext);
  });
  it('select _ from tbl0, tbl1 as t1, tbl2 t2', async () => {
    const { sql, position } = current;
    const sqlContext = analyzeContext(
      parser as unknown as ParserType,
      sql,
      position,
    );
    console.log('sqlContext:', sqlContext);
  });
  it('select t1._ from tbl0, tbl1 as t1, tbl2 t2', async () => {
    const { sql, position } = current;
    const sqlContext = analyzeContext(
      parser as unknown as ParserType,
      sql,
      position,
    );
    console.log('sqlContext:', sqlContext);
  });
  it('select * from tbl0 join _', async () => {
    const { sql, position } = current;
    const sqlContext = analyzeContext(
      parser as unknown as ParserType,
      sql,
      position,
    );
    console.log('sqlContext:', sqlContext);
  });
  it('select * from tbl0 join tbl1 as t1 on _', async () => {
    const { sql, position } = current;
    const sqlContext = analyzeContext(
      parser as unknown as ParserType,
      sql,
      position,
    );
    console.log('sqlContext:', sqlContext);
  });
  it('select * from tbl0 join tbl1 as t1 on t1._', async () => {
    const { sql, position } = current;
    const sqlContext = analyzeContext(
      parser as unknown as ParserType,
      sql,
      position,
    );
    console.log('sqlContext:', sqlContext);
  });
});

/**
 * 递归地将 SyntaxNode 及其子节点格式化为带缩进的字符串。
 *
 * @param {Parser.SyntaxNode} node 要格式化的节点。
 * @param {object} [options] 配置选项。
 * @param {boolean} [options.includeAnonymous=false] 是否包含匿名节点 (如标点符号)。默认为 false，只显示命名节点。
 * @param {boolean} [options.includeText=false] 是否在每行末尾包含节点的文本内容 (可能会截断)。默认为 false。
 * @param {number} [options.maxTextLength=30] 如果 includeText 为 true，节点文本的最大显示长度。
 * @returns {string} 格式化后的字符串树。
 */
function formatNodeTree(
  node,
  { includeAnonymous = false, includeText = false, maxTextLength = 30 } = {},
) {
  if (!node) {
    return '<null node>';
  }
  // 内部递归函数
  function _recursiveToString(currentNode, indentLevel, prefix) {
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
      result += _recursiveToString(child, indentLevel + 1, childPrefix);
    });
    return result;
  }

  // 启动递归，初始缩进为0，无前缀
  return _recursiveToString(node, 0, '');
}
