use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use sqlparser::parser::Parser;

use crate::{api::RawArrowData};

pub mod ast;
pub mod clickhouse;
pub mod duckdb;
pub mod file;
pub mod folder;
pub mod mysql;
pub mod postgres;
pub mod sqlite;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeNode {
  pub name: String,
  pub path: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub children: Option<Vec<TreeNode>>,
  #[serde(rename(serialize = "type"))]
  pub node_type: String,
  pub size: Option<u64>,
  pub comment: Option<String>,
}

impl TreeNode {
  pub fn new_views(key: &str, children: Option<Vec<TreeNode>>) -> Self {
    Self {
      name: "views".to_string(),
      path: format!("{key}-views"),
      node_type: "path".to_string(),
      children,
      size: None,
      comment: None,
    }
  }
  pub fn new_tables(key: &str, children: Option<Vec<TreeNode>>) -> Self {
    Self {
      name: "tables".to_string(),
      path: format!("{key}-tables"),
      node_type: "path".to_string(),
      children,
      size: None,
      comment: None,
    }
  }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Title {
  pub name: String,
  pub r#type: String,
}

#[async_trait]
pub trait Connection: Sync + Send {
  async fn get_db(&self) -> anyhow::Result<TreeNode>;
  async fn query(&self, _sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    unimplemented!()
  }

  async fn query_count(&self, _sql: &str) -> anyhow::Result<usize> {
    unimplemented!()
  }
  async fn query_all(&self, _sql: &str) -> anyhow::Result<RawArrowData> {
    unimplemented!()
  }

  // fn dialect() -> sqlparser::dialect::GenericDialect {
  //   sqlparser::dialect::GenericDialect {}
  // }

  async fn paging_query(
    &self,
    sql: &str,
    limit: Option<usize>,
    offset: Option<usize>,
  ) -> anyhow::Result<RawArrowData> {
    let mut sql = sql.to_string();
    let dialect = sqlparser::dialect::GenericDialect {};
    let stmt = Parser::parse_sql(&dialect, &sql).ok().and_then(|t| {
      if t.len() == 1 {
        Some(t[0].clone())
      } else {
        None
      }
    });

    if let Some(ref _stmt) = stmt {
      sql = ast::limit_stmt(&dialect, _stmt, limit, offset).unwrap_or(sql);
    }
    let mut res = self.query(&sql, 0, 0).await?;

    // get total row count
    if let Some(ref _stmt) = stmt {
      if let Some(count_sql) = ast::count_stmt(&dialect, _stmt) {
        log::info!("count_sql: {count_sql}");
        if let Ok(count) = self.query_count(&count_sql).await {
          res.total = count;
        };
      }
    }
    Ok(res)
  }

  async fn _sql_row_count(&self, _sql: &str) -> anyhow::Result<usize> {
    unimplemented!()
  }

  async fn query_table(
    &self,
    table: &str,
    limit: usize,
    offset: usize,
    where_: &str,
    order_by: &str,
  ) -> anyhow::Result<RawArrowData> {
    let mut sql = self._table_query_sql(table, where_, order_by);

    if limit != 0 {
      sql = format!("{sql} limit {}", limit)
    }
    if offset != 0 {
      sql = format!("{sql} offset {offset}")
    }
    println!("query table {}: {}", table, sql);
    let res = self.query(&sql, 0, 0).await;

    let total = self
      .table_row_count(table, where_)
      .await
      .unwrap_or_default();

    res.map(|r| RawArrowData { total, ..r })
  }

  async fn show_schema(&self, _schema: &str) -> anyhow::Result<RawArrowData> {
    unimplemented!()
  }

  async fn show_column(&self, _schema: Option<&str>, _table: &str) -> anyhow::Result<RawArrowData> {
    unimplemented!()
  }

  async fn drop_table(&self, _schema: Option<&str>, _table: &str) -> anyhow::Result<String> {
    unimplemented!()
  }

  async fn table_row_count(&self, _table: &str, _where: &str) -> anyhow::Result<usize> {
    unimplemented!()
  }

  fn _table_count_sql(&self, table: &str, where_: &str) -> String {
    let mut sql = format!("select count(*) from {table}");
    if !where_.trim().is_empty() {
      sql = format!("{sql} where {where_}");
    }
    sql
  }

  fn _table_query_sql(&self, table: &str, where_: &str, order_by: &str) -> String {
    let mut sql = format!("select * from {table}");
    if !where_.trim().is_empty() {
      sql = format!("{sql} where {where_}");
    }
    if !order_by.trim().is_empty() {
      sql = format!("{sql} order by {order_by}");
    }
    sql
  }

  async fn export(&self, _sql: &str, _file: &str) {
    unimplemented!()
  }
}

pub async fn _paging_query(
  d: &dyn Connection,
  dialect: &dyn sqlparser::dialect::Dialect,
  sql: &str,
  limit: Option<usize>,
  offset: Option<usize>,
) -> anyhow::Result<RawArrowData> {
  let mut sql = sql.to_string();
  let stmt = Parser::parse_sql(dialect, &sql)
    .ok()
    .map(|t| {
      if t.len() == 1 {
        Some(t[0].clone())
      } else {
        None
      }
    })
    .flatten();

  if let Some(ref _stmt) = stmt {
    sql = ast::limit_stmt(dialect, _stmt, limit, offset).unwrap_or(sql);
  }
  let mut res = d.query(&sql, 0, 0).await?;

  // get total row count
  if let Some(ref _stmt) = stmt {
    if let Some(count_sql) = ast::count_stmt(dialect, _stmt) {
      log::info!("count_sql: {count_sql}");
      if let Ok(count) = d.query_count(&count_sql).await {
        res.total = count;
      };
    }
  }
  Ok(res)
}
