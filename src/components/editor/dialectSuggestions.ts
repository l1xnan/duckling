import { ContextType, SuggestionType } from '@/ast/analyze';

/**
 * Universal SQL keyword set (uppercase by SQL convention; keywords are
 * case-insensitive in every supported dialect).
 */
export const SQL_KEYWORDS: string[] = [
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT',
  'OFFSET', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'OUTER', 'ON',
  'USING', 'AS', 'DISTINCT', 'ALL', 'UNION', 'EXCEPT', 'INTERSECT', 'AND',
  'OR', 'NOT', 'NULL', 'IS', 'IN', 'LIKE', 'ILIKE', 'BETWEEN', 'EXISTS',
  'ANY', 'SOME', 'TRUE', 'FALSE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'CAST', 'ASC', 'DESC', 'WITH', 'RECURSIVE', 'CREATE', 'TABLE', 'VIEW',
  'SCHEMA', 'DATABASE', 'INDEX', 'ALTER', 'ADD', 'DROP', 'TRUNCATE', 'INSERT',
  'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'MERGE', 'REPLACE', 'GRANT',
  'REVOKE', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK',
  'CONSTRAINT', 'DEFAULT', 'COLLATE', 'ANALYZE', 'EXPLAIN', 'DESCRIBE',
  'SHOW', 'PRAGMA', 'CALL', 'COPY', 'EXPORT', 'IMPORT', 'INSTALL', 'LOAD',
  'ATTACH', 'DETACH', 'CHECKPOINT', 'SUMMARIZE', 'PIVOT', 'UNPIVOT',
  'QUALIFY', 'WINDOW', 'OVER', 'PARTITION', 'RANGE', 'ROWS', 'PRECEDING',
  'FOLLOWING', 'FETCH', 'FIRST', 'NEXT', 'RETURNING', 'DO', 'BEGIN', 'COMMIT',
  'ROLLBACK', 'TRANSACTION', 'MACRO', 'FUNCTION', 'SECRET', 'TEMPORARY',
  'TEMP', 'STRUCT', 'MAP', 'LIST', 'ARRAY', 'BOTH', 'LEADING', 'TRAILING',
  'SIMILAR', 'CONCURRENTLY', 'DECLARE', 'GLOB', 'PERSISTENT', 'MATERIALIZED',
  'IF', 'NOTNULL', 'ISNULL', 'CURRENT_DATE', 'CURRENT_TIME',
  'CURRENT_TIMESTAMP', 'CURRENT_USER', 'CURRENT_CATALOG', 'CURRENT_SCHEMA',
];

/** Curated per-dialect function lists (fallback when the DB cannot be queried). */
export const DIALECT_FUNCTIONS: Record<string, string[]> = {
  duckdb: [
    'abs', 'acos', 'acosh', 'any_value', 'approx_count_distinct', 'arg_max',
    'arg_min', 'array_agg', 'array_append', 'array_contains', 'array_distinct',
    'array_filter', 'array_length', 'array_map', 'array_max', 'array_min',
    'array_pop_back', 'array_pop_front', 'array_prepend', 'array_reduce',
    'array_remove', 'array_reverse', 'array_slice', 'array_sort',
    'array_transform', 'array_unique', 'asin', 'asinh', 'atan', 'atan2',
    'atan2d', 'atand', 'avg', 'base64_decode', 'base64_encode', 'bit_count',
    'bit_length', 'bitwise_and', 'bitwise_not', 'bitwise_or', 'bitwise_xor',
    'bool_and', 'bool_or', 'cardinality', 'ceil', 'ceiling', 'char_length',
    'chr', 'coalesce', 'concat', 'concat_ws', 'contains', 'corr', 'cos',
    'cosd', 'cot', 'count', 'count_if', 'covar_pop', 'covar_samp',
    'cume_dist', 'current_date', 'current_time', 'current_timestamp',
    'date_add', 'date_diff', 'date_part', 'date_sub', 'date_trunc',
    'datediff', 'datetrunc', 'degrees', 'dense_rank', 'exp', 'extract',
    'first', 'first_value', 'floor', 'format', 'gcd', 'generate_series',
    'glob', 'greatest', 'group_concat', 'grouping', 'hash', 'hex',
    'histogram', 'ifnull', 'iif', 'last', 'last_value', 'lcm', 'lcase',
    'least', 'left', 'len', 'length', 'list', 'list_aggregate', 'list_append',
    'list_concat', 'list_contains', 'list_distinct', 'list_filter', 'list_has',
    'list_prepend', 'list_reduce', 'list_sort', 'list_transform', 'ln', 'log',
    'log10', 'log2', 'lower', 'lpad', 'ltrim', 'max', 'md5', 'median', 'min',
    'mod', 'mode', 'nextval', 'now', 'ntile', 'nullif', 'octet_length',
    'percentile_cont', 'percentile_disc', 'pi', 'position', 'pow', 'power',
    'product', 'quantile_cont', 'quantile_disc', 'radians', 'random', 'range',
    'rank', 'read_csv', 'read_json', 'read_parquet', 'read_text',
    'regexp_extract', 'regexp_matches', 'regexp_replace', 'repeat', 'replace',
    'reverse', 'right', 'round', 'row_number', 'rpad', 'rtrim', 'sin', 'sind',
    'sqrt', 'stddev', 'stddev_pop', 'stddev_samp', 'strftime', 'string_split',
    'strptime', 'struct_extract', 'struct_pack', 'substring', 'substr', 'sum',
    'tan', 'tand', 'tanh', 'time_bucket', 'to_base64', 'to_char', 'to_date',
    'to_days', 'to_hex', 'to_timestamp', 'trim', 'truncate', 'typeof', 'ucase',
    'unicode', 'unnest', 'upper', 'var_pop', 'var_samp', 'variance',
    'width_bucket',
  ],
  postgres: [
    'abs', 'acos', 'age', 'array_agg', 'array_append', 'array_cat',
    'array_length', 'array_prepend', 'array_remove', 'array_replace',
    'array_to_string', 'ascii', 'asin', 'atan', 'atan2', 'avg', 'bit_length',
    'btrim', 'cardinality', 'cbrt', 'ceil', 'ceiling', 'char_length', 'chr',
    'coalesce', 'concat', 'concat_ws', 'corr', 'cos', 'cot', 'count',
    'covar_pop', 'covar_samp', 'cume_dist', 'current_date', 'current_schema',
    'current_time', 'current_timestamp', 'current_user', 'date_part',
    'date_trunc', 'degrees', 'dense_rank', 'exp', 'extract', 'first_value',
    'floor', 'format', 'generate_series', 'greatest', 'json_agg',
    'json_build_object', 'json_extract_path', 'jsonb_agg',
    'jsonb_build_object', 'lag', 'last_value', 'lead', 'least', 'left',
    'length', 'ln', 'log', 'lower', 'lpad', 'ltrim', 'make_date',
    'make_interval', 'make_time', 'make_timestamp', 'max', 'md5', 'min',
    'mod', 'now', 'ntile', 'nullif', 'octet_length', 'percentile_cont',
    'percentile_disc', 'pi', 'position', 'pow', 'power', 'radians', 'random',
    'rank', 'regexp_match', 'regexp_matches', 'regexp_replace', 'repeat',
    'replace', 'reverse', 'right', 'round', 'row_number', 'rpad', 'rtrim',
    'sign', 'sin', 'split_part', 'sqrt', 'stddev', 'stddev_pop', 'stddev_samp',
    'string_agg', 'string_to_array', 'string_to_table', 'substr',
    'substring', 'sum', 'tan', 'timezone', 'to_char', 'to_date', 'to_json',
    'to_jsonb', 'to_number', 'to_timestamp', 'translate', 'trim', 'trunc',
    'unnest', 'upper', 'var_pop', 'var_samp', 'variance', 'width_bucket',
  ],
  mysql: [
    'abs', 'acos', 'adddate', 'addtime', 'ascii', 'asin', 'atan', 'atan2',
    'avg', 'bin', 'bit_and', 'bit_count', 'bit_length', 'bit_or', 'bit_xor',
    'cast', 'ceil', 'ceiling', 'char', 'char_length', 'character_length',
    'coalesce', 'concat', 'concat_ws', 'connection_id', 'conv', 'convert',
    'cos', 'cot', 'count', 'curdate', 'current_date', 'current_time',
    'current_timestamp', 'curtime', 'database', 'date', 'date_add',
    'date_format', 'date_sub', 'datediff', 'day', 'dayname', 'dayofmonth',
    'dayofweek', 'dayofyear', 'degrees', 'exp', 'extract', 'field',
    'find_in_set', 'floor', 'format', 'from_days', 'from_unixtime',
    'greatest', 'group_concat', 'hex', 'hour', 'if', 'ifnull', 'inet_aton',
    'inet_ntoa', 'instr', 'interval', 'isnull', 'json_extract', 'json_object',
    'json_quote', 'json_set', 'json_type', 'json_unquote', 'last_day',
    'lcase', 'least', 'left', 'length', 'ln', 'locate', 'log', 'log10',
    'log2', 'lower', 'lpad', 'ltrim', 'make_set', 'max', 'md5', 'microsecond',
    'mid', 'min', 'minute', 'mod', 'month', 'monthname', 'now', 'nullif',
    'oct', 'octet_length', 'ord', 'period_add', 'period_diff', 'pi',
    'position', 'pow', 'power', 'quarter', 'quote', 'radians', 'rand',
    'repeat', 'replace', 'reverse', 'right', 'round', 'rpad', 'rtrim',
    'sec_to_time', 'second', 'session_user', 'sign', 'sin', 'sleep',
    'soundex', 'space', 'sqrt', 'std', 'stddev', 'stddev_pop', 'stddev_samp',
    'str_to_date', 'strcmp', 'substring', 'substring_index', 'sum', 'sysdate',
    'tan', 'time', 'time_format', 'time_to_sec', 'timediff', 'timestamp',
    'timestampadd', 'timestampdiff', 'to_days', 'to_seconds', 'trim',
    'truncate', 'ucase', 'unhex', 'unix_timestamp', 'upper', 'user',
    'utc_date', 'utc_time', 'utc_timestamp', 'uuid', 'var_pop', 'var_samp',
    'variance', 'version', 'week', 'weekday', 'weekofyear', 'year', 'yearweek',
  ],
  sqlite: [
    'abs', 'avg', 'changes', 'char', 'coalesce', 'concat', 'concat_ws',
    'count', 'date', 'datetime', 'exp', 'floor', 'format', 'glob',
    'group_concat', 'hex', 'ifnull', 'iif', 'instr', 'json', 'json_array',
    'json_array_length', 'json_extract', 'json_insert', 'json_object',
    'json_quote', 'json_remove', 'json_set', 'json_type', 'json_valid',
    'last_insert_rowid', 'length', 'like', 'load_extension', 'lower', 'ltrim',
    'max', 'min', 'nullif', 'printf', 'quote', 'random', 'randomblob',
    'replace', 'round', 'rtrim', 'sign', 'soundex', 'sqlite_offset',
    'sqlite_source_id', 'sqlite_version', 'strftime', 'substr', 'sum',
    'total', 'total_changes', 'trim', 'typeof', 'unicode', 'unixepoch',
    'upper', 'zeroblob',
  ],
  // ClickHouse function names are case-sensitive — keep exact canonical case.
  clickhouse: [
    'abs', 'acos', 'addDays', 'addHours', 'addMinutes', 'addMonths',
    'addSeconds', 'addWeeks', 'addYears', 'arrayAll', 'arrayAny',
    'arrayConcat', 'arrayCount', 'arrayDistinct', 'arrayElement',
    'arrayExists', 'arrayFilter', 'arrayFirst', 'arrayFlatten', 'arrayJoin',
    'arrayMap', 'arrayMax', 'arrayMin', 'arrayReduce', 'arrayReverse',
    'arraySlice', 'arraySort', 'arraySum', 'arrayUniq', 'assumeNotNull',
    'avg', 'bar', 'bitAnd', 'bitCount', 'bitLength', 'bitOr', 'bitXor',
    'ceil', 'coalesce', 'concat', 'concatAssumeInjective', 'count', 'countIf',
    'dateDiff', 'dateName', 'dateTrunc', 'dayOfMonth', 'dayOfWeek',
    'dayOfYear', 'degrees', 'dictGet', 'divide', 'empty', 'emptyArray',
    'emptyArrayString', 'endsWith', 'exp', 'extract', 'formatDateTime',
    'fromUnixTimestamp', 'gcd', 'geomean', 'groupArray', 'groupArrayLast',
    'groupBitAnd', 'groupBitOr', 'groupBitXor', 'groupUniqArray', 'hex',
    'hour', 'if', 'ifNull', 'intDiv', 'intDivOrZero', 'isEmpty', 'isFinite',
    'isInfinite', 'isNaN', 'isNotNull', 'isNull', 'jsonExtract',
    'jsonExtractArray', 'jsonExtractBool', 'jsonExtractFloat',
    'jsonExtractInt', 'jsonExtractKeysAndValues', 'jsonExtractRaw',
    'jsonExtractString', 'jsonHas', 'lcm', 'length', 'like', 'lower', 'lpad',
    'ltrim', 'map', 'mapKeys', 'mapValues', 'max', 'max2', 'median', 'min',
    'min2', 'minute', 'modulo', 'month', 'multiply', 'negate', 'not',
    'notEmpty', 'notLike', 'now', 'nullIf', 'numberFormat', 'percentRank',
    'plus', 'pow', 'printf', 'quantile', 'quantileExact', 'quantileTiming',
    'radians', 'rand', 'randConstant', 'range', 'replace', 'replaceAll',
    'replaceOne', 'replaceRegexpAll', 'replaceRegexpOne', 'round',
    'roundBankers', 'roundDuration', 'roundToExp2', 'rpad', 'rtrim',
    'sequenceCount', 'sequenceMatch', 'sign', 'sin', 'size', 'sleep',
    'splitByChar', 'splitByRegexp', 'splitByString', 'startsWith',
    'stddevPop', 'stddevSamp', 'substring', 'subtractDays', 'subtractHours',
    'subtractMinutes', 'subtractMonths', 'subtractSeconds', 'subtractWeeks',
    'subtractYears', 'sum', 'sumIf', 'sumMap', 'sumWithOverflow', 'tan',
    'timeSlots', 'toDate', 'toDateTime', 'toDateTime64', 'toDecimal32',
    'toDecimal64', 'toDecimal128', 'toFixedString', 'toFloat32', 'toFloat64',
    'toInt8', 'toInt16', 'toInt32', 'toInt64', 'toIntervalDay',
    'toIntervalHour', 'toIntervalMinute', 'toIntervalMonth',
    'toIntervalSecond', 'toIntervalWeek', 'toIntervalYear', 'toLowCardinality',
    'toMonth', 'toString', 'toUInt8', 'toUInt16', 'toUInt32', 'toUInt64',
    'toUnixTimestamp', 'today', 'trim', 'uniq', 'uniqExact', 'uniqHLL12',
    'upper', 'uuid', 'uuidNumToString', 'uuidStringToNum', 'varPop',
    'varSamp', 'week', 'year', 'yesterday',
  ],
};

/** duckdb group covers quack / folder / file connections (DuckDB engine). */
export function functionsForDialect(dialect?: string): string[] {
  const d = dialect ?? 'duckdb';
  if (d === 'quack' || d === 'folder' || d === 'file') {
    return DIALECT_FUNCTIONS.duckdb;
  }
  return DIALECT_FUNCTIONS[d] ?? DIALECT_FUNCTIONS.duckdb;
}

export function buildKeywordSuggestions(keywords?: string[]): SuggestionType[] {
  const list = keywords && keywords.length > 0 ? keywords : SQL_KEYWORDS;
  return list.map((kw) => ({
    type: ContextType.KEYWORD,
    label: kw,
    insertText: kw,
  }));
}

/** Function items insert as `name($0)` so the cursor lands inside the parens. */
export function buildFunctionSuggestions(functions: string[]): SuggestionType[] {
  return functions.map((name) => ({
    type: ContextType.FUNCTION,
    label: name,
    insertText: `${name}($0)`,
    snippet: true,
  }));
}

/** Merge keeping the first occurrence per case-insensitive label (DB results first). */
export function unionSuggestions(
  base: SuggestionType[],
  extra: SuggestionType[],
): SuggestionType[] {
  const seen = new Set<string>();
  const out: SuggestionType[] = [];
  for (const item of [...base, ...extra]) {
    const key = item.label.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}
