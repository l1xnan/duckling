import { formatSQL as formatWithSqlriver, type SQLDialect } from 'sqlriver';
import { format as formatWithSqlFormatter, type SqlLanguage } from 'sql-formatter';

import { formatSqlWithSqlfmt } from '@/api';
import { getDuckdbSqlriverProfile } from '@/components/editor/sqlriverDuckdbProfile';
import { DialectType } from '@/stores/dbList';
import {
  SqlFormatterEngine,
  normalizeSqlFormatterEngine,
  resolveSqlFormatterOptions,
  resolveSqlfmtOptions,
  resolveSqlriverOptions,
  useSettingStore,
} from '@/stores/setting';

export type FormatSqlOptions = {
  engine?: SqlFormatterEngine | 'holywell';
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

/** Map app connection dialect → sqlriver dialect / custom profile. */
export function toSqlriverDialect(
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
      return getDuckdbSqlriverProfile();
    default:
      return 'ansi';
  }
}

/** @deprecated Use `toSqlriverDialect` (holywell was renamed to sqlriver). */
export const toHolywellDialect = toSqlriverDialect;

export async function formatSqlText(
  text: string,
  options: FormatSqlOptions = {},
): Promise<string> {
  const settings = useSettingStore.getState();
  const resolved = normalizeSqlFormatterEngine(
    options.engine ?? settings.sql_formatter_engine ?? 'sql-formatter',
  );

  if (resolved === 'shandy-sqlfmt') {
    const sqlfmt = resolveSqlfmtOptions(settings);
    return formatSqlWithSqlfmt(text, {
      path: sqlfmt.path,
      lineLength: sqlfmt.lineLength,
      dialect: sqlfmt.dialect,
    });
  }

  if (resolved === 'sqlriver') {
    const sqlriver = resolveSqlriverOptions(
      settings.sqlriver_options,
      settings.holywell_options,
    );
    return formatWithSqlriver(text, {
      dialect: toSqlriverDialect(options.dialect),
      maxLineLength: sqlriver.maxLineLength,
      recover: sqlriver.recover,
    });
  }

  const fmt = resolveSqlFormatterOptions(settings.sql_formatter_options);
  return formatWithSqlFormatter(text, {
    language: toSqlFormatterLanguage(options.dialect),
    tabWidth: fmt.tabWidth,
    useTabs: fmt.useTabs,
    keywordCase: fmt.keywordCase,
    identifierCase: fmt.identifierCase,
    dataTypeCase: fmt.dataTypeCase,
    functionCase: fmt.functionCase,
    indentStyle: fmt.indentStyle,
    logicalOperatorNewline: fmt.logicalOperatorNewline,
    expressionWidth: fmt.expressionWidth,
    linesBetweenQueries: fmt.linesBetweenQueries,
    denseOperators: fmt.denseOperators,
    newlineBeforeSemicolon: fmt.newlineBeforeSemicolon,
  });
}
