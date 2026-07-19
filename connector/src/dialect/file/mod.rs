use std::path::PathBuf;

use async_trait::async_trait;

use crate::utils::RawArrowData;
use crate::dialect::Connection;
use crate::dialect::duckdb::duckdb_sync;
use crate::utils::{TreeNode, get_file_name};

#[derive(Debug, Default)]
pub struct FileConnection {
  pub path: String,
}

#[async_trait]
impl Connection for FileConnection {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let path = PathBuf::from(self.path.as_str());
    let node_type = path
      .extension()
      .map(|e| e.to_string_lossy().to_string())
      .unwrap_or_else(|| "file".to_string());

    Ok(TreeNode {
      path: self.path.clone(),
      name: get_file_name(&self.path),
      node_type,
      schema: None,
      children: None,
      size: None,
      comment: None,
    })
  }

  fn dialect(&self) -> &'static str {
    "file"
  }

  async fn query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    let path = self.path.clone();
    let sql = sql.to_string();
    crate::dialect::run_blocking(move || {
      let conn = duckdb::Connection::open_in_memory()?;
      let _ = path;
      duckdb_sync::query(&conn, &sql)
    })
    .await
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let sql = self._table_count_sql(table, r#where);
    crate::dialect::run_blocking(move || {
      let conn = duckdb::Connection::open_in_memory()?;
      let total = conn.query_row(&sql, [], |row| row.get::<_, i64>(0))? as usize;
      Ok(total)
    })
    .await
  }

  fn normalize(&self, name: &str) -> String {
    name.to_string()
  }
}
