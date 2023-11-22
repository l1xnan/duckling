use std::path::Path;
use std::{cmp::Ordering, fs};

use crate::dialect::{Dialect, TreeNode};

#[derive(Debug, Default)]
pub struct FileDialect {
  path: String,
}

impl Dialect for FileDialect {
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
        let mut cmp = (a.node_type == "path").cmp(&(b.node_type == "path"));
        if cmp == Ordering::Equal {
          cmp = a.name.cmp(&b.name)
        }
        cmp
      });

      child_nodes.sort_by_key(|k| {
        let is_dir = (k.node_type == "path") as u8;
        let name = k.name.as_str();
        format!("{is_dir}-{name}")
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
