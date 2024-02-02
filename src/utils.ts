import { Theme } from "@mui/material";

import { OrderByType, StmtType } from "./stores/dataset";

export const isDarkTheme = (theme: Theme) => theme.palette.mode === "dark";

export const borderTheme = (theme: Theme) =>
  isDarkTheme(theme) ? "1px solid #393b40" : "1px solid #ebecf0";

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
  return `${name} ${desc ? "DESC" : ""}`;
}
export function genStmt({ tableName, orderBy, where }: StmtType) {
  let stmt = `select * from ${tableName}`;
  if (!!where && where.length > 0) {
    stmt = `${stmt} where ${where}`;
  }
  if (!!orderBy && orderBy.name) {
    stmt = `${stmt} order by ${convertOrderBy(orderBy)}`;
  }
  return stmt;
}

export const debounce = <F extends (...args: any[]) => any>(
  func: F,
  delay: number = 300,
) => {
  let timeout: number = 0;

  const debounced = (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };

  return debounced;
};
