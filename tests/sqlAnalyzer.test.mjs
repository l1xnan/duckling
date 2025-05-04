// tests/sqlAnalyzer.test.js
/// <reference path="../types/tree-sitter.d.ts" />
import { describe, it } from 'vitest';
import SQL from '@l1xnan/tree-sitter-sql';
import Parser, { Query } from 'tree-sitter';

import { get_tables, } from '@/ast/analyze';

export function initParser() {
  const parser = new Parser();
  parser.setLanguage(SQL);
  parser.query = (source) => new Query(SQL, source);
  return parser;
}


export function analyzeContext(sql, position) {
  const parser = initParser();
  const tree = parser.parse(sql);
  const rootNode = tree.rootNode;
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
    const start = `[${currentNode.startPosition.row}, ${currentNode.startPosition.column}]`;
    const end = `[${currentNode.endPosition.row}, ${currentNode.endPosition.column}]`;

    let textSuffix = '';
    if (includeText) {
      let text = currentNode.text.replace(/\s+/g, ' '); // 将连续空白替换为单个空格
      if (text.length > maxTextLength) {
        text = text.substring(0, maxTextLength) + '...';
      }
      textSuffix = `  "${text}"`; // 在末尾添加文本预览
    }
    // 格式化当前节点行: 缩进 + 前缀(字段名) + 类型 + 范围 [+ 文本]
    let result = `${indent}${prefix}${currentNode.type} ${start} - ${end}${textSuffix}\n`;

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

// --- Test Data ---

// --- Test Suite ---
describe('analyzeSqlAtPosition', () => {
  const parser = initParser();

  // Basic check - Vitest will ensure async tests are handled
  it('select * from _', async (ctx) => {
    const sql = ctx.task.name;
    const tree = parser.parse(sql);
    const rootNode = tree.rootNode;
    const position = sql.indexOf('_');
    console.log('tree:');
    console.log(rootNode.toString());
    console.log('position:', position);
    const sqlContext = analyzeContext(sql, position);
    console.log('sqlContext:', sqlContext);
  });
  it('select _ from tbl as t', async (ctx) => { });
  it('select _ from tbl0, tbl1 as t1, tbl2 t2', async (ctx) => {
    const sql = ctx.task.name;
    const tree = parser.parse(sql);

    const rootNode = tree.rootNode;
    console.log(rootNode.toString());
    console.log(formatNodeTree(rootNode));
    const position = sql.indexOf('_');
    const sqlContext = analyzeContext(sql, position);
    console.log('sqlContext:', sqlContext);
  });
});
