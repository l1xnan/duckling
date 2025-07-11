use anyhow::{Result, anyhow};
use arrow::array::*;
use arrow::csv::WriterBuilder;
use arrow::datatypes::SchemaRef;
use arrow::datatypes::*;
use arrow::ipc::writer::StreamWriter;
use arrow::json::ReaderBuilder;
use arrow::record_batch::RecordBatch;
use arrow::util::display::FormatOptions;
use chrono::NaiveDate;
use chrono::{Datelike, NaiveDateTime, Timelike};
use parquet::basic::{Compression, ZstdLevel};
use parquet::{arrow::ArrowWriter, file::properties::WriterProperties};
use rust_xlsxwriter::{Workbook, XlsxError};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs::File;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeNode {
  pub name: String,
  pub path: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub children: Option<Vec<TreeNode>>,
  #[serde(rename(serialize = "type"))]
  pub node_type: String,
  pub schema: Option<String>,
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
      schema: None,
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
      schema: None,
      comment: None,
    }
  }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Title {
  pub name: String,
  pub r#type: String,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Metadata {
  pub database: String,
  pub table: String,
  pub columns: Vec<(String, String)>,
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
    if let Some(schema) = t.schema.clone() {
      keys.push(schema);
    }
    keys.push(t.table_name.clone());
    let path = keys.join(".");
    db.push(TreeNode {
      name: t.table_name,
      path,
      node_type: t.r#type,
      schema: t.schema,
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
      schema: None,
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
pub fn write_parquet(file: &str, batch: &RecordBatch) -> anyhow::Result<()> {
  let file = File::create(file)?;
  // WriterProperties can be used to set Parquet file options
  let props = WriterProperties::builder()
    .set_compression(Compression::ZSTD(ZstdLevel::try_new(22)?))
    .build();
  let mut writer = ArrowWriter::try_new(file, batch.schema(), Some(props))?;
  writer.write(&batch).expect("Writing batch");
  // writer must be closed to write footer
  writer.close()?;

  Ok(())
}

pub fn write_xlsx(file: &str, batch: &RecordBatch) -> Result<()> {
  // 1. 创建一个新的 Excel 工作簿和工作表
  let mut workbook = Workbook::new();
  let worksheet = workbook.add_worksheet();
  let schema = batch.schema();

  // 2. 逐列处理
  for (col_idx, (field, column_array)) in schema.fields().iter().zip(batch.columns()).enumerate() {
    // Excel 列索引是 u16 类型
    let xlsx_col = col_idx as u16;

    // 写入表头
    worksheet.write_string(0, xlsx_col, field.name())?;

    // 核心逻辑：将整个 Arrow Array 转换为 Vec<T>，然后使用 write_column 一次性写入。
    // 我们从第 1 行开始写入数据（第 0 行是表头）。
    let start_row = 1;

    match column_array.data_type() {
      DataType::Boolean => {
        let array = column_array
          .as_any()
          .downcast_ref::<BooleanArray>()
          .unwrap();
        // .iter() 产生 Iterator<Item = Option<bool>>，正是 write_column 所需的
        worksheet.write_column(start_row, xlsx_col, array.iter())?;
      }
      // --- 回退机制 ---
      _ => {
        let options = FormatOptions::default();
        let formatter =
          arrow::util::display::ArrayFormatter::try_new(column_array.as_ref(), &options)?;
        let data: Vec<String> = (0..column_array.len())
          .map(|i| formatter.value(i).to_string())
          .collect();
        worksheet.write_column(start_row, xlsx_col, &data)?;
      }
    }
  }

  // 3. 保存工作簿
  workbook
    .save(file)
    .map_err(|e| anyhow!("Failed to save XLSX file: {}", e))?;

  println!("Successfully wrote data to {}", file);
  Ok(())
}

pub fn batch_write(file: &str, batch: &RecordBatch, format: &str) -> anyhow::Result<()> {
  if format == "csv" {
    write_csv(file, batch)?;
  } else if format == "parquet" {
    write_parquet(file, batch)?;
  } else if format == "xlsx" {
    write_xlsx(file, batch)?
  }
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
