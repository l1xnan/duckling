use std::error::Error;

use async_trait::async_trait;
use sqlx::any;
use sqlx::sqlite::SqlitePool;
use sqlx::Row;
use sqlx::Sqlite;
use sqlx::SqliteConnection;

use crate::api::ArrowData;
use crate::dialect::{Dialect, TreeNode};
use crate::utils::{build_tree, get_file_name, Table};
use sqlx::error::DatabaseError;
use sqlx::pool::PoolOptions;
use sqlx::sqlite::{SqliteConnectOptions, SqliteError};
use sqlx::ConnectOptions;
use sqlx::TypeInfo;
use sqlx::{sqlite::Sqlite, Column, Executor};
use sqlx::{Connection, Database, Pool};
use std::env;

// Make a new connection
// Ensure [dotenvy] and [env_logger] have been setup
pub async fn new<DB>(path: &str) -> anyhow::Result<DB::Connection>
where
  DB: Database,
{
  Ok(DB::Connection::connect(path).await?)
}

#[derive(Debug, Default)]
pub struct SqliteDialect {
  pub path: String,
}

#[async_trait]
impl Dialect for SqliteDialect {
  async fn get_db(&self) -> Option<TreeNode> {
    let url = self.get_url();
    if let Ok(tables) = get_tables(&url).await {
      let mut tree = build_tree(tables);
      let children = if tree.len() > 0 {
        &tree[0].children
      } else {
        &None
      };
      Some(TreeNode {
        name: get_file_name(&self.path),
        path: self.path.clone(),
        node_type: "root".to_string(),
        children: children.clone(),
      })
    } else {
      None
    }
  }

  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<ArrowData> {
    // let pool = SqlitePool::connect(&self.path).await?;
    let mut conn = new::<Sqlite>(&self.path).await?;
    // let conn = SqliteConnection ::connect(&self.path).await?;
    let info = conn.describe(sql).await?;
    let columns = info.columns();
    println!("{:?}", columns);

    anyhow::Error(())
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
      table_type: r.get::<String, _>("type"),
      table_schema: "".to_string(),
      r#type: r.get::<String, _>("type"),
    })
    .collect();
  Ok(tables)
}
