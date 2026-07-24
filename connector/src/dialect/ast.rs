use sqlparser::ast::Statement;
use sqlparser::parser::Parser;

pub fn count_sql(sql: &str) -> String {
  format!("select count(*) from ({sql}) ____")
}

pub fn limit_sql(sql: &str, limit: Option<usize>, offset: Option<usize>) -> String {
  let mut sql = format!("select * from ({sql}) ____");
  if let Some(limit) = limit {
    sql = format!("{sql} limit {limit}");
  }
  if let Some(offset) = offset {
    sql = format!("{sql} offset {offset}");
  }
  sql
}

pub fn count_stmt(dialect: &str, stmt: &Statement) -> Option<String> {
  let dialect = convert_dialect(dialect);
  let dialect = &*dialect;
  match stmt {
    Statement::Query(query) => {
      if let Some(ref with) = query.with {
        let mut tmp = query.clone();
        let tmp = tmp.as_mut();
        tmp.with = None;

        let count_sql = count_sql(&tmp.to_string());
        let Ok(mut parsed) = Parser::parse_sql(dialect, &count_sql) else {
          return Some(count_sql);
        };
        let Some(stmt) = parsed.get_mut(0) else {
          return Some(count_sql);
        };

        if let Statement::Query(tmp) = stmt {
          tmp.with = Some(with.clone());
          Some(tmp.to_string())
        } else {
          None
        }
      } else {
        Some(count_sql(&query.to_string()))
      }
    }
    _ => None,
  }
}

pub fn first_stmt(dialect: &str, sql: &str) -> Option<Statement> {
  let dialect = convert_dialect(dialect);
  let dialect = &*dialect;
  Parser::parse_sql(dialect, sql).ok().and_then(|t| {
    if t.len() == 1 {
      Some(t[0].clone())
    } else {
      None
    }
  })
}

pub fn limit_stmt(
  dialect: &str,
  stmt: &Statement,
  limit: Option<usize>,
  offset: Option<usize>,
) -> Option<String> {
  let dialect = convert_dialect(dialect);
  let dialect = &*dialect;
  match stmt {
    Statement::Query(query) => {
      if let Some(ref with) = query.with {
        let mut tmp = query.clone();
        let tmp = tmp.as_mut();
        tmp.with = None;

        let count_sql = limit_sql(&tmp.to_string(), limit, offset);
        let Ok(mut parsed) = Parser::parse_sql(dialect, &count_sql) else {
          return Some(count_sql);
        };
        let Some(stmt) = parsed.get_mut(0) else {
          return Some(count_sql);
        };

        if let Statement::Query(tmp) = stmt {
          tmp.with = Some(with.clone());
          Some(tmp.to_string())
        } else {
          None
        }
      } else {
        Some(limit_sql(&query.to_string(), limit, offset))
      }
    }
    _ => None,
  }
}


/// Map connector dialect names to sqlparser dialect implementations.
pub fn convert_dialect(d: &str) -> Box<dyn sqlparser::dialect::Dialect> {
  match d {
    "folder" | "file" | "duckdb" | "quack" => Box::new(sqlparser::dialect::DuckDbDialect {}),
    "clickhouse" => Box::new(sqlparser::dialect::ClickHouseDialect {}),
    "mysql" => Box::new(sqlparser::dialect::MySqlDialect {}),
    "postgres" => Box::new(sqlparser::dialect::PostgreSqlDialect {}),
    "sqlite" => Box::new(sqlparser::dialect::SQLiteDialect {}),
    _ => Box::new(sqlparser::dialect::GenericDialect {}),
  }
}

/// 1-based line/column of a sqlparser failure on the given SQL text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SqlParseLocation {
  pub line: u64,
  pub column: u64,
  pub message: String,
}

/// If `sql` fails to parse under `dialect`, return the error location (relative to `sql`).
/// On successful parse, returns `None` (caller should not mark syntax positions for pure semantic errors).
pub fn locate_sql_parse_error(dialect: &str, sql: &str) -> Option<SqlParseLocation> {
  let trimmed = sql.trim();
  if trimmed.is_empty() {
    return None;
  }
  let d = convert_dialect(dialect);
  match Parser::parse_sql(&*d, sql) {
    Ok(_) => None,
    Err(err) => {
      let message = err.to_string();
      let (line, column) = parse_location_from_message(&message).unwrap_or((1, 1));
      Some(SqlParseLocation {
        line: line.max(1),
        column: column.max(1),
        message,
      })
    }
  }
}

/// Extract `at Line: N, Column: M` from sqlparser error Display text.
pub fn parse_location_from_message(message: &str) -> Option<(u64, u64)> {
  // sqlparser Location Display: " at Line: {line}, Column: {column}"
  let re = regex::Regex::new(
    r"(?i)at\s+Line:\s*(\d+)\s*,\s*Column:\s*(\d+)",
  )
  .ok()?;
  let caps = re.captures(message)?;
  let line = caps.get(1)?.as_str().parse().ok()?;
  let column = caps.get(2)?.as_str().parse().ok()?;
  Some((line, column))
}

#[cfg(test)]
mod tests {

  use std::ops::Deref;

  use super::*;

  #[test]
  fn test_sql() {
    let select_sql = "
    SELECT a, b, 123, myfunc(b)
    FROM table_1
    WHERE a > b AND b < 100
    ORDER BY a DESC, b";

    let d = "generic";
    let d = convert_dialect(d);
    let dialect = d.deref();

    let ast = Parser::parse_sql(dialect, select_sql).unwrap();

    assert_eq!(
      count_stmt("generic", &ast[0]).unwrap(),
      "select count(*) from (SELECT a, b, 123, myfunc(b) FROM table_1 WHERE a > b AND b < 100 ORDER BY a DESC, b) ____"
    );

    let cte_sql = "
    with tmp as (select * from table_1)
    SELECT a, b, 123, myfunc(b)
    FROM tmp
    WHERE a > b AND b < 100
    ORDER BY a DESC, b";

    let ast = Parser::parse_sql(dialect, cte_sql).unwrap();

    assert_eq!(
      count_stmt("generic", &ast[0]).unwrap(),
      "WITH tmp AS (SELECT * FROM table_1) SELECT count(*) FROM (SELECT a, b, 123, myfunc(b) FROM tmp WHERE a > b AND b < 100 ORDER BY a DESC, b) AS ____"
    )
  }

  #[test]
  fn convert_dialect_covers_known_names() {
    for name in [
      "mysql",
      "postgres",
      "duckdb",
      "folder",
      "file",
      "quack",
      "clickhouse",
      "sqlite",
      "unknown-dialect",
    ] {
      let _ = convert_dialect(name);
    }
  }

  #[test]
  fn limit_sql_pages_for_export() {
    let sql = limit_sql("select * from t", Some(5000), Some(10000));
    assert!(sql.contains("limit 5000"));
    assert!(sql.contains("offset 10000"));
  }

  #[test]
  fn locate_sql_parse_error_returns_none_for_valid_sql() {
    assert!(
      locate_sql_parse_error("generic", "select 1 as a")
        .is_none()
    );
  }

  #[test]
  fn locate_sql_parse_error_finds_line_column() {
    let sql = "select 1 as a\nselect from";
    let loc = locate_sql_parse_error("generic", sql).expect("expected parse error");
    assert!(loc.line >= 1);
    assert!(loc.column >= 1);
    assert!(!loc.message.is_empty());
  }

  #[test]
  fn parse_location_from_message_reads_sqlparser_format() {
    assert_eq!(
      parse_location_from_message("Expected: something at Line: 3, Column: 12"),
      Some((3, 12))
    );
  }
}
