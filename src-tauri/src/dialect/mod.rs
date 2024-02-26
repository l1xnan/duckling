use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::api::ArrowData;

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

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Title {
  pub name: String,
  pub r#type: String,
}

#[async_trait]
pub trait Dialect: Sync + Send {
  async fn get_db(&self) -> anyhow::Result<TreeNode>;
  async fn query(&self, _sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<ArrowData> {
    unimplemented!()
  }
  async fn export(&self, _sql: &str, _file: &str) {
    unimplemented!()
  }
}

pub mod sql {
  use crate::api::show_db_information;
  use crate::api::ArrowData;

  pub fn show_tables(path: String) -> anyhow::Result<ArrowData> {
    show_db_information(
      path,
      "select * from information_schema.tables order by table_type, table_name",
    )
  }
}
