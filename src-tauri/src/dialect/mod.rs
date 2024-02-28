use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::api::RawArrowData;
use crate::sql;

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
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Title {
  pub name: String,
  pub r#type: String,
}

#[async_trait]
pub trait Dialect: Sync + Send {
  async fn get_db(&self) -> anyhow::Result<TreeNode>;
  async fn query(&self, _sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    unimplemented!()
  }
  async fn paging_query(
    &self,
    _sql: &str,
    _limit: Option<usize>,
    _offset: Option<usize>,
  ) -> anyhow::Result<RawArrowData> {
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
      sql = format!("{sql} limit {}", limit + 1)
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

    res.map(|r| RawArrowData {
      total_count: total,
      ..r
    })
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
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
