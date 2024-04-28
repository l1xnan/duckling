import { Theme } from '@mui/material';

import { DataType } from '@apache-arrow/ts';
import { isEmpty } from 'radash';
import { OrderByType, StmtType } from './stores/dataset';
import { NodeElementType, TreeNode } from './types';

export const isDarkTheme = (theme: Theme) => theme.palette.mode === 'dark';

export const borderTheme = (theme: Theme) =>
  isDarkTheme(theme) ? '1px solid #393b40' : '1px solid #ebecf0';

export function getByteLength(str: string) {
  let length = 0;
  [...str].forEach((char) => {
    length += char.charCodeAt(0) > 255 ? 2 : 1;
  });
  return length;
}

export function convertOrderBy({ name, desc }: OrderByType) {
  if (!name) {
    return undefined;
  }
  return `${name} ${desc ? 'DESC' : ''}`;
}

export function genStmt({ tableName, orderBy, where }: StmtType) {
  let stmt = `select *
              from ${tableName}`;
  if (!!where && where.length > 0) {
    stmt = `${stmt} where ${where}`;
  }
  if (!!orderBy && orderBy.name) {
    stmt = `${stmt} order by ${convertOrderBy(orderBy)}`;
  }
  return stmt;
}

export function compareAny(a: unknown, b: unknown) {
  if (typeof a != typeof b || typeof a === 'string' || typeof b === 'string') {
    return {}.toString.call(a).localeCompare({}.toString.call(b));
  }
  return (a as number) - (b as number);
}

export function isNumber(dataType: string) {
  return (
    dataType.includes('Int') ||
    dataType.includes('Float') ||
    dataType.includes('Decimal')
  );
}

export function isNumberType(dataType: DataType) {
  return (
    DataType.isDecimal(dataType) ||
    DataType.isFloat(dataType) ||
    DataType.isInt(dataType)
  );
}

export function isFloat(dataType: string) {
  return dataType.includes('Float') || dataType.includes('Decimal');
}

export function uniqueArray<T>(arr: T[]) {
  const seen = new Set();
  return Array.from(arr.filter((item) => !seen.has(item) && seen.add(item)));
}

export function filterTree(node: TreeNode | NodeElementType, filter?: string) {
  if (!node) return null;
  if (isEmpty(filter)) return node;

  // 检查当前节点的值是否包含字符串
  const isMatch = node.path?.includes(filter as string);
  if (isMatch) {
    return node;
  }
  // 递归处理子节点
  const children = (node.children
    ?.map((child) => filterTree(child, filter))
    .filter(Boolean) ?? []) as TreeNode[];

  // 如果当前节点或其子节点包含字符串，则保留当前节点
  if (children.length > 0) {
    return { ...node, children };
  }
  return null; // 否则过滤当前节点
}

export function convertId(
  data: TreeNode,
  dbId: string,
  displayName?: string,
): NodeElementType {
  data.children = data?.children?.map((item) => convertId(item, dbId));
  return {
    id: `${dbId}:${data.path}`,
    dbId,
    icon: data.type ?? 'file',
    ...data,
    displayName,
  } as NodeElementType;
}

export type Node3Type = {
  data: NodeElementType;
  name: string;
  children?: string[];
};

export function convertTreeToMap(
  data?: NodeElementType,
): Record<string, Node3Type> {
  const res: Record<string, Node3Type> = {};

  const dfs = (item: NodeElementType) => {
    res[item.id] = {
      data: item,
      name: item.name,
      children: item.children?.map((t) => {
        dfs(t);
        return t.id;
      }),
    };
  };
  if (data) {
    dfs(data);
  }

  return res;
}
