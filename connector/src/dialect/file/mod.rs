use std::path::PathBuf;

use async_trait::async_trait;

use crate::api::{self, RawArrowData};
use crate::dialect::Connection;
use crate::utils::{get_file_name, TreeNode};

#[derive(Debug, Default)]
pub struct FileConnection {
  pub path: String,
}

impl FileConnection {
  fn connect(&self) -> anyhow::Result<duckdb::Connection> {
    Ok(duckdb::Connection::open_in_memory()?)
  }
}

#[async_trait]
impl Connection for FileConnection {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let path = PathBuf::from(self.path.as_str());

    Ok(TreeNode {
      path: self.path.clone(),
      name: get_file_name(&self.path),
      node_type: path.extension().unwrap().to_string_lossy().to_string(),
      children: None,
      size: None,
      comment: None,
    })
  }

  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<RawArrowData> {
    api::query(":memory:", sql, limit, offset, None)
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let conn = self.connect()?;
    let sql = self._table_count_sql(table, r#where);
    let total = conn.query_row(&sql, [], |row| row.get::<_, usize>(0))?;
    Ok(total)
  }

  fn normalize(&self, name: &str) -> String {
    name.to_string()
  }
}
