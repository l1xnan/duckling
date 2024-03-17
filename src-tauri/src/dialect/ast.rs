use sqlparser::ast::Statement;
use sqlparser::dialect::Dialect;
use sqlparser::dialect::GenericDialect;
use sqlparser::parser::Parser;

pub fn count_sql(sql: &str) -> String {
  format!("select count(*) from ({}) ____", sql)
}

pub fn limit_sql(sql: &str, limit: Option<usize>, offset: Option<usize>) -> String {
  let mut sql = format!("select * from ({}) ____", sql);
  if let Some(limit) = limit {
    sql = format!("{sql} limit {}", limit);
  }
  if let Some(offset) = offset {
    sql = format!("{sql} offset {offset}");
  }
  sql
}

pub fn count_stmt(dialect: &dyn Dialect, stmt: &Statement) -> Option<String> {
  match stmt {
    Statement::Query(query) => {
      if let Some(ref with) = query.with {
        let mut tmp = query.clone();
        let tmp = tmp.as_mut();
        tmp.with = None;

        let count_sql = count_sql(&tmp.to_string());
        let stmt: &mut Statement = &mut Parser::parse_sql(dialect, &count_sql).unwrap()[0];

        if let Statement::Query(ref mut tmp) = stmt {
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

pub fn limit_stmt(
  dialect: &dyn Dialect,
  stmt: &Statement,
  limit: Option<usize>,
  offset: Option<usize>,
) -> Option<String> {
  match stmt {
    Statement::Query(query) => {
      if let Some(ref with) = query.with {
        let mut tmp = query.clone();
        let tmp = tmp.as_mut();
        tmp.with = None;

        let count_sql = limit_sql(&tmp.to_string(), limit, offset);
        let stmt: &mut Statement = &mut Parser::parse_sql(dialect, &count_sql).unwrap()[0];

        if let Statement::Query(ref mut tmp) = stmt {
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

fn parse_order_by_expr(order_by: &str) -> Vec<(String, Option<bool>)> {
  let sql = format!("select * from __ order by {order_by}");

  let dialect = GenericDialect {};
  let stmts = Parser::parse_sql(&dialect, &sql).unwrap();

  let mut exprs = vec![];
  for stmt in &stmts {
    if let Statement::Query(ref tmp) = stmt {
      for expr in &tmp.order_by {
        exprs.push((expr.expr.to_string(), expr.asc))
      }
    }
  }
  exprs
}

#[cfg(test)]
mod tests {
  use sqlparser::dialect::GenericDialect;

  use super::*;

  #[test]
  fn test_sql() {
    let select_sql = "
    SELECT a, b, 123, myfunc(b) 
    FROM table_1 
    WHERE a > b AND b < 100 
    ORDER BY a DESC, b";

    let dialect = GenericDialect {};

    let ast = Parser::parse_sql(&dialect, select_sql).unwrap();

    assert_eq!(count_stmt(&dialect, &ast[0]).unwrap(), "select count(*) from (SELECT a, b, 123, myfunc(b) FROM table_1 WHERE a > b AND b < 100 ORDER BY a DESC, b) ____");

    let cte_sql = "
    with tmp as (select * from table_1)
    SELECT a, b, 123, myfunc(b) 
    FROM tmp 
    WHERE a > b AND b < 100 
    ORDER BY a DESC, b";

    let ast = Parser::parse_sql(&dialect, cte_sql).unwrap();

    assert_eq!(count_stmt(&dialect, &ast[0]).unwrap(), "WITH tmp AS (SELECT * FROM table_1) SELECT count(*) FROM (SELECT a, b, 123, myfunc(b) FROM tmp WHERE a > b AND b < 100 ORDER BY a DESC, b) AS ____")
  }

  #[test]
  fn test_order_by_expr() {
    let exprs = parse_order_by_expr("a DESC, b, c + 1 ASC");
    println!("{:?}", exprs);
    assert_eq!(exprs[0].1.unwrap(), false);
    assert_eq!(exprs[2].0, "c + 1");

    // let serialized = serde_json::to_string_pretty(&stmts).unwrap();
    // println!("Serialized as JSON:\n{serialized}");
  }
}
