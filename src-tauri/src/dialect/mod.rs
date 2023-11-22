mod file;

pub struct TreeNode {
  name: String,
  path: String,
  children: Option<Vec<TreeNode>>,
  node_type: String,
}

pub trait Dialect {
  fn get_node_tree(&self) -> Option<TreeNode> {
    None
  }

  fn get_db(&self) -> Option<TreeNode> {
    None
  }

  fn query(&self) {}
}
