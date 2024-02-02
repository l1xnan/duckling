use async_trait::async_trait;
use sqlx::sqlite::SqlitePool;
use sqlx::Connection;
use sqlx::Row;

use crate::dialect::{Dialect, TreeNode};
use crate::utils::{build_tree, get_file_name, Table};

#[derive(Debug, Default)]
pub struct SqliteDialect {
  pub path: String,
}

#[async_trait]
impl Dialect for SqliteDialect {
  async fn get_db(&self) -> Option<TreeNode> {
    let url = self.get_url();
    if let Ok(tables) = get_tables(&url).await {
      Some(TreeNode {
        name: get_file_name(&self.path),
        path: self.path.clone(),
        node_type: "root".to_string(),
        children: Some(build_tree(tables)),
      })
    } else {
      None
    }
  }
}

impl SqliteDialect {
  fn get_url(&self) -> String {
    format!("sqlite:{}", self.path)
  }

  async fn get_schema(&self) -> Vec<Table> {
    vec![]
  }
}

pub async fn get_tables(path: &str) -> anyhow::Result<Vec<Table>> {
  let pool = SqlitePool::connect(path).await?;

  let sql = r#"
  SELECT tbl_name, name, type
  FROM sqlite_master WHERE type IN ('table', 'view')
  "#;
  let rows = sqlx::query(sql).fetch_all(&pool).await?;

  let tables: Vec<Table> = rows
    .iter()
    .map(|r| Table {
      table_name: r.get::<String, _>("name"),
      table_type: r.get::<String, _>("name"),
      table_schema: r.get::<String, _>("name"),
      r#type: r.get::<String, _>("name"),
    })
    .collect();
  Ok(tables)
}
