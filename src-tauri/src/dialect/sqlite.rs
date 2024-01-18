use crate::dialect::sql;
use crate::dialect::{Dialect, TreeNode};
use crate::utils::{build_tree, get_file_name, Table};
use sqlx::{FromRow, Row};
use sqlx::Connection;
use std::path::{Path, PathBuf};
use sqlx::sqlite::SqlitePool;
#[derive(Debug, Default)]
pub struct SqliteDialect {
  pub path: String,
}

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
  //   for row in rows {
  //     let table = Table {
  //       table_name: row::<String, _>("name"),
  //       table_type:row::<String, _>("name"),
  //       table_schema: row::<String, _>("name"),
  //       r#type: row::<String, _>("name"),
  //     };
  //     tables.push(table);
  //   }

  Ok(tables)
}
