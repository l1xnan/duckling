use std::path::{Path, PathBuf};

use duckdb::{params, Connection};
use nanoid::format;

use crate::dialect::sql;
use crate::dialect::{Dialect, TreeNode};
use clickhouse_rs::{types::Block, Client, Pool};

#[derive(Debug, Default)]
pub struct ClickhouseDialect {
  pub host: String,
  pub port: String,
  pub username: String,
  pub password: String,
}

impl ClickhouseDialect {
  fn get_url(&self) -> String {
    format!(
      "tcp://{}:{}@{}:{}/clicks?compression=lz4&ping_timeout=42ms",
      self.username, self.password, self.host, self.port,
    )
  }
}

struct Table {
  table_name: String,
  table_type: String,
  table_schema: String,
}

impl Dialect for ClickhouseDialect {
  async fn get_db(&self) -> Option<TreeNode> {
    let url = self.get_url();
    let pool = Pool::new(url);
    let mut client = pool.get_handle();
    let block = client
      .query("select database, name from system.tables")
      .fetch_all()
      .await?;
    for row in block.rows() {
      let database: String = row.get("database")?;
      let name: String = row.get("name")?;
      println!("tables: {}.{}", database, name);
    }
    None
  }
}

impl ClickhouseDialect {
  fn get_schema(&self) -> Vec<Table> {
    vec![]
  }
}
