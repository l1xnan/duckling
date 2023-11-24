use std::fs;
use std::path::Path;

use crate::dialect::{Dialect, TreeNode};

#[derive(Debug, Default)]
pub struct FolderDialect {
  pub path: String,
}

impl Dialect for FolderDialect {
  fn get_db(&self) -> Option<TreeNode> {
    directory_tree(self.path.as_str())
  }
}

pub fn directory_tree<P: AsRef<Path>>(path: P) -> Option<TreeNode> {
  let path = path.as_ref();

  let is_dir = path.is_dir();
  let name = path.file_name().unwrap().to_string_lossy().to_string();

  let support_types = vec!["csv", "xlsx", "parquet"];

  let mut node_type = String::from("path");

  if !is_dir {
    let file_ext = path.extension().unwrap().to_string_lossy().to_string();
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
    path: path.display().to_string().replace("\\", "/"),
    children,
    node_type,
  })
}
