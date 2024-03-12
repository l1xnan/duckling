import { Theme } from '@mui/material';

import { OrderByType, StmtType } from './stores/dataset';
import { TreeNode } from './types';

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

export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T,
  delay: number,
) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    const p = new Promise<ReturnType<T> | Error>((resolve, reject) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const output = callback(...args);
          resolve(output);
        } catch (err) {
          if (err instanceof Error) {
            reject(err);
          }
          reject(new Error(`An error has occurred:${err}`));
        }
      }, delay);
    });
    return p;
  };
}

export function isEmpty(v: string | unknown[] | number | null | undefined) {
  if (typeof v === 'string') {
    return v.length == 0;
  }
  if (Array.isArray(v)) {
    return v.length == 0;
  }

  return !v;
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
export function isFloat(dataType: string) {
  return dataType.includes('Float') || dataType.includes('Decimal');
}

export function uniqueArray<T>(arr: T[]) {
  const seen = new Set();
  return Array.from(arr.filter((item) => !seen.has(item) && seen.add(item)));
}

export function filterTree(node: TreeNode, filter: string) {
  if (!node) return null;

  // 检查当前节点的值是否包含字符串
  const isMatch = node.path.includes(filter);
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
