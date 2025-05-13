use std::collections::BTreeMap;
use std::fs::File;
use std::path::Path;

use arrow::csv::WriterBuilder;
use arrow::datatypes::SchemaRef;
use arrow::ipc::writer::StreamWriter;
use arrow::json::ReaderBuilder;
use arrow::record_batch::RecordBatch;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeNode {
  pub name: String,
  pub path: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub children: Option<Vec<TreeNode>>,
  #[serde(rename(serialize = "type"))]
  pub node_type: String,
  pub size: Option<u64>,
  pub comment: Option<String>,
}

impl TreeNode {
  pub fn new_views(key: &str, children: Option<Vec<TreeNode>>) -> Self {
    Self {
      name: "views".to_string(),
      path: format!("{key}-views"),
      node_type: "path".to_string(),
      children,
      size: None,
      comment: None,
    }
  }
  pub fn new_tables(key: &str, children: Option<Vec<TreeNode>>) -> Self {
    Self {
      name: "tables".to_string(),
      path: format!("{key}-tables"),
      node_type: "path".to_string(),
      children,
      size: None,
      comment: None,
    }
  }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Title {
  pub name: String,
  pub r#type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Table {
  pub table_name: String,
  pub table_type: String,
  pub db_name: String,
  pub schema: Option<String>,
  pub r#type: String,
  pub size: Option<u64>,
}

pub struct RawArrowData {
  /// The total number of rows that were selected.
  pub total: usize,
  pub batch: RecordBatch,
  pub titles: Option<Vec<Title>>,
  pub sql: Option<String>,
}

impl RawArrowData {
  pub fn from_batch(batch: RecordBatch) -> Self {
    Self {
      total: batch.num_rows(),
      titles: None,
      sql: None,
      batch,
    }
  }
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
      keys.push(t.db_name.clone());
    }
    if let Some(schema) = t.schema {
      keys.push(schema);
    }
    keys.push(t.table_name.clone());
    db.push(TreeNode {
      name: t.table_name,
      path: keys.join("."),
      node_type: t.r#type.clone(),
      children: None,
      size: t.size,
      comment: None,
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
        TreeNode::new_tables(key, Some(tables_children)),
        TreeNode::new_views(key, Some(views_children)),
      ]),
      size: None,
      comment: None,
    });
  }

  databases
}

pub fn write_csv(file: &str, batch: &RecordBatch) -> anyhow::Result<()> {
  let file = File::create(file)?;
  let builder = WriterBuilder::new().with_header(true);
  let mut writer = builder.build(file);
  writer.write(batch)?;
  Ok(())
}

pub fn date_to_days(t: &NaiveDate) -> i32 {
  t.signed_duration_since(NaiveDate::from_ymd_opt(1970, 1, 1).unwrap())
    .num_days() as i32
}

pub fn json_to_arrow<S: Serialize>(rows: &[S], schema: SchemaRef) -> anyhow::Result<RecordBatch> {
  let mut decoder = ReaderBuilder::new(schema).build_decoder()?;
  decoder.serialize(rows)?;
  let batch = decoder.flush()?.unwrap();
  Ok(batch)
}

pub fn serialize_preview(record: &RecordBatch) -> Result<Vec<u8>, arrow::error::ArrowError> {
  let mut writer = StreamWriter::try_new(Vec::new(), &record.schema())?;
  writer.write(record)?;
  writer.into_inner()
}
