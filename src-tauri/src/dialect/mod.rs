use serde::{Deserialize, Serialize};

pub mod folder;
pub mod duckdb;
pub mod clickhouse;
pub mod file;

pub use self::folder::FolderDialect;

#[derive(Debug, Serialize, Deserialize)]
pub struct TreeNode {
  pub name: String,
  pub path: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub children: Option<Vec<TreeNode>>,
  #[serde(rename(serialize = "type"))]
  pub node_type: String,
}

pub trait Dialect {
  fn get_db(&self) -> Option<TreeNode>;

  fn query(&self) {}
}

pub mod sql {
  use crate::api::show_db_information;

  use crate::api::ArrowData;

  use anyhow::anyhow;

  pub fn show_tables(path: String) -> anyhow::Result<ArrowData> {
    show_db_information(
      path,
      "select * from information_schema.tables order by table_type, table_name",
    )
  }
}
