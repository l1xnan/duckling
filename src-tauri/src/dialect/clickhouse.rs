use std::path::{Path, PathBuf};

use duckdb::{params, Connection};

use crate::dialect::sql;
use crate::dialect::{Dialect, TreeNode};
use clickhouse_rs::{types::Block, Client, Pool};

#[derive(Debug, Default)]
pub struct ClickhouseDialect {
  pub path: String,
  pub username: String,
  pub password: String,
}

struct Table {
  table_name: String,
  table_type: String,
  table_schema: String,
}

impl Dialect for ClickhouseDialect {
  async fn get_db(&self) -> Option<TreeNode> {
    // let pool = Pool::new(database_url);
    None
  }
}

impl ClickhouseDialect {
  fn get_schema(&self) -> Vec<Table> {
    vec![]
  }
}

