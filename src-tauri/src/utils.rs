use std::collections::BTreeMap;
use std::path::Path;

use crate::dialect::TreeNode;

pub struct Table {
  pub table_name: String,
  pub table_type: String,
  pub table_schema: String,
  pub r#type: String,
}

pub fn get_file_name<P: AsRef<Path>>(path: P) -> String {
  path
    .as_ref()
    .file_name()
    .unwrap()
    .to_string_lossy()
    .to_string()
}


pub fn build_tree(tables: Vec<Table>) -> Vec<TreeNode> {
  let mut databases = vec![];

  let mut tree: BTreeMap<String, Vec<TreeNode>> = BTreeMap::new();

  for t in tables {
    let db = tree.entry(t.table_schema.clone()).or_default();
    db.push(TreeNode {
      name: t.table_name.clone(),
      path: t.table_name.clone(),
      node_type: t.r#type.clone(),
      children: None,
    });
  }
  for (key, nodes) in &tree {
    let mut tables_children = vec![];
    let mut views_children = vec![];

    for node in nodes {
      if node.node_type == "view" {
        views_children.push(node.clone());
      } else {
        tables_children.push(node.clone());
      }
    }

    databases.push(TreeNode {
      name: key.to_string(),
      path: key.to_string(),
      node_type: "database".to_string(),
      children: Some(vec![
        TreeNode {
          name: "tables".to_string(),
          path: format!("{key}-tables"),
          node_type: "path".to_string(),
          children: Some(tables_children),
        },
        TreeNode {
          name: "views".to_string(),
          path: format!("{key}-views"),
          node_type: "path".to_string(),
          children: Some(views_children),
        },
      ]),
    });
  }

  databases
}
