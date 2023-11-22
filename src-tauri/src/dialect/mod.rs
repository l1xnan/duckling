pub struct NodeTree {}

pub trait Dialect {
  fn get_node_tree(&self) -> Option<NodeTree> {
    None
  }

  fn query(&self) {}
}
