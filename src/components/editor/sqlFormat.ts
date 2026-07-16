import { formatSQL as formatWithHolywell, type SQLDialect } from 'holywell';
import { format as formatWithSqlFormatter, type SqlLanguage } from 'sql-formatter';

import { formatSqlWithSqlfmt } from '@/api';
import { getDuckdbHolywellProfile } from '@/components/editor/holywellDuckdbProfile';
import { DialectType } from '@/stores/dbList';
import { SqlFormatterEngine, useSettingStore } from '@/stores/setting';

export type FormatSqlOptions = {
  engine?: SqlFormatterEngine;
  dialect?: DialectType | string | null;
};

/** Map app connection dialect → sql-formatter language. */
export function toSqlFormatterLanguage(
  dialect?: DialectType | string | null,
): SqlLanguage {
  switch (dialect) {
    case 'mysql':
      return 'mysql';
    case 'postgres':
      return 'postgresql';
    case 'sqlite':
      return 'sqlite';
    case 'clickhouse':
    case 'clickhouse_tcp':
      return 'clickhouse';
    case 'duckdb':
    case 'quack':
    case 'folder':
    case 'file':
      return 'duckdb';
    default:
      return 'sql';
  }
}

/** Map app connection dialect → holywell dialect / custom profile. */
export function toHolywellDialect(
  dialect?: DialectType | string | null,
): SQLDialect {
  switch (dialect) {
    case 'mysql':
      return 'mysql';
    case 'postgres':
      return 'postgres';
    case 'duckdb':
    case 'quack':
    case 'folder':
    case 'file':
      return getDuckdbHolywellProfile();
    default:
      return 'ansi';
  }
}

export async function formatSqlText(
  text: string,
  options: FormatSqlOptions = {},
): Promise<string> {
  const settings = useSettingStore.getState();
  const resolved =
    options.engine ?? settings.sql_formatter_engine ?? 'sql-formatter';

  if (resolved === 'shandy-sqlfmt') {
    return formatSqlWithSqlfmt(text, settings.sqlfmt_path);
  }

  if (resolved === 'holywell') {
    return formatWithHolywell(text, {
      dialect: toHolywellDialect(options.dialect),
    });
  }

  return formatWithSqlFormatter(text, {
    language: toSqlFormatterLanguage(options.dialect),
    tabWidth: 2,
    keywordCase: 'upper',
  });
}
