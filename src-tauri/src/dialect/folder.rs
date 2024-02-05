use anyhow::anyhow;
use arrow::csv::WriterBuilder;
use async_trait::async_trait;
use std::env::current_dir;
use std::fs::File;
use std::path::Path;
use std::{env::set_current_dir, fs};

use duckdb::Connection;

use crate::api;
use crate::utils::write_csv;
use crate::{
  api::{serialize_preview, ArrowData},
  dialect::{Dialect, TreeNode},
};

#[derive(Debug, Default)]
pub struct FolderDialect {
  pub path: String,
  pub cwd: Option<String>,
}

#[async_trait]
impl Dialect for FolderDialect {
  async fn get_db(&self) -> Option<TreeNode> {
    directory_tree(self.path.as_str())
  }

  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<ArrowData> {
    api::query(":memory:", sql, limit, offset, self.cwd.clone())
  }

  async fn export(&self, sql: &str, file: &str) {
    let data = api::fetch_all(":memory:", sql, self.cwd.clone());
    if let Ok(batch) = data {
      write_csv(file, &batch);
    }
  }
}

impl FolderDialect {
  fn new(path: &str) -> Self {
    Self {
      path: String::from(path),
      cwd: None,
    }
  }

  fn get_connect() -> Connection {
    Connection::open_in_memory().unwrap()
  }
}

pub fn directory_tree<P: AsRef<Path>>(path: P) -> Option<TreeNode> {
  let path = path.as_ref();
  let is_dir = path.is_dir();
  let name = path.file_name().unwrap().to_string_lossy().to_string();

  let support_types = ["csv", "xlsx", "parquet"];

  let mut node_type = String::from("path");

  if !is_dir {
    if let Some(file_ext) = path.extension() {
      let file_ext = file_ext.to_string_lossy().to_string();
      if !support_types.contains(&file_ext.as_str()) {
        return None;
      }

      if name.starts_with("~$") && name.ends_with(".xlsx") {
        return None;
      }

      if name.starts_with("~$") && file_ext == "xlsx" {
        return None;
      }

      node_type = file_ext;
    }
  };

  let mut children = None;

  if is_dir {
    if let Ok(entries) = fs::read_dir(path) {
      let mut child_nodes = Vec::new();
      for entry in entries {
        if let Ok(entry) = entry {
          let child_path = entry.path();
          if let Some(child_node) = directory_tree(&child_path) {
            child_nodes.push(child_node);
          }
        }
      }

      child_nodes.sort_by(|a, b| {
        (a.node_type == "path")
          .cmp(&(b.node_type == "path"))
          .reverse()
          .then(a.name.cmp(&b.name))
      });

      children = Some(child_nodes);
    }
  }

  Some(TreeNode {
    name,
    path: path.display().to_string().replace('\\', "/"),
    children,
    node_type,
  })
}
