use std::path::PathBuf;

use async_trait::async_trait;
use duckdb::Connection;

use crate::api::{self, RawArrowData};
use crate::dialect::{Dialect, TreeNode};
use crate::utils::get_file_name;

#[derive(Debug, Default)]
pub struct FileDialect {
  pub path: String,
}

impl FileDialect {
  fn connect(&self) -> anyhow::Result<Connection> {
    Ok(Connection::open_in_memory()?)
  }
}

#[async_trait]
impl Dialect for FileDialect {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let path = PathBuf::from(self.path.as_str());

    Ok(TreeNode {
      path: self.path.clone(),
      name: get_file_name(&self.path),
      node_type: path.extension().unwrap().to_string_lossy().to_string(),
      children: None,
    })
  }

  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<RawArrowData> {
    api::query(":memory:", sql, limit, offset, None)
  }

  async fn query_table(
    &self,
    table: &str,
    limit: usize,
    offset: usize,
    where_: Option<&str>,
    order_by: Option<&str>,
  ) -> anyhow::Result<RawArrowData> {
    let sql = self._table_query_sql(
      table,
      where_.unwrap_or_default(),
      order_by.unwrap_or_default(),
    );
    println!("query table {}: {}", table, sql);
    self.query(&sql, limit, offset).await
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let conn = self.connect()?;
    let sql = self._table_count_sql(table, r#where);
    let total = conn.query_row(&sql, [], |row| row.get::<_, usize>(0))?;
    Ok(total)
  }
}
