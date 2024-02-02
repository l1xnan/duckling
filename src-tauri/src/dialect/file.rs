use async_trait::async_trait;
use std::path::PathBuf;

use crate::dialect::{Dialect, TreeNode};
use crate::utils::get_file_name;

#[derive(Debug, Default)]
pub struct FileDialect {
  pub path: String,
}

#[async_trait]
impl Dialect for FileDialect {
  async fn get_db(&self) -> Option<TreeNode> {
    let path = PathBuf::from(self.path.as_str());

    Some(TreeNode {
      path: self.path.clone(),
      name: get_file_name(&self.path),
      node_type: path.extension().unwrap().to_string_lossy().to_string(),
      children: None,
    })
  }
}
