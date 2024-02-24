use std::collections::BTreeMap;
use std::fs::File;
use std::path::Path;

use arrow::csv::WriterBuilder;
use arrow::record_batch::RecordBatch;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
// use sqlx::{Connection, Database};

use crate::dialect::TreeNode;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Table {
  pub table_name: String,
  pub table_type: String,
  pub db_name: String,
  pub schema: Option<String>,
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
    let db = tree.entry(t.db_name.clone()).or_default();
    let mut keys = vec![];
    if !t.db_name.is_empty() {
      keys.push(t.db_name.clone())
    }
    if let Some(schema) = t.schema {
      keys.push(schema)
    }
    keys.push(t.table_name.clone());
    db.push(TreeNode {
      name: t.table_name,
      path: keys.join("."),
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

pub fn write_csv(file: &str, batch: &RecordBatch) {
  let file = File::create(file).unwrap();

  // create a builder that doesn't write headers
  let builder = WriterBuilder::new().with_header(true);
  let mut writer = builder.build(file);

  writer.write(batch).unwrap();
}

pub fn date_to_days(t: &NaiveDate) -> i32 {
  t.signed_duration_since(NaiveDate::from_ymd_opt(1970, 1, 1).unwrap())
    .num_days() as i32
}

// // Make a new connection
// // Ensure [dotenvy] and [env_logger] have been setup
// pub async fn new_conn<DB>(path: &str) -> anyhow::Result<DB::Connection>
// where
//   DB: Database,
// {
//   Ok(DB::Connection::connect(path).await?)
// }
