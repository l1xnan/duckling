use anyhow::anyhow;
use arrow::{ipc::writer::StreamWriter, record_batch::RecordBatch};
use duckdb::Connection;
use std::path::Path;
use tauri::Manager;

use log::info;
use serde::{Deserialize, Serialize};
use std::env::{current_dir, set_current_dir};
use std::fs;

#[derive(Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct ArrowData {
  /// The total number of rows that were selected.
  pub total_count: u64,
  /// A preview of the first N records, serialized as an Apache Arrow array
  /// using their IPC format.
  pub preview: Vec<u8>,
}

#[derive(Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct ArrowResponse {
  /// The total number of rows that were selected.
  pub total: u64,
  /// A preview of the first N records, serialized as an Apache Arrow array
  /// using their IPC format.
  pub data: Vec<u8>,

  pub code: i32,
  pub message: String,
}

pub fn convert(res: anyhow::Result<ArrowData>) -> ArrowResponse {
  match res {
    Ok(data) => ArrowResponse {
      total: data.total_count,
      data: data.preview,
      code: 0,
      message: "".to_string(),
    },
    Err(err) => ArrowResponse {
      total: 0,
      data: vec![],
      code: 401,
      message: err.to_string(),
    },
  }
}

fn serialize_preview(record: &RecordBatch) -> Result<Vec<u8>, arrow::error::ArrowError> {
  let mut writer = StreamWriter::try_new(Vec::new(), &record.schema())?;
  writer.write(record)?;
  writer.into_inner()
}

pub fn query(
  path: &str,
  sql: String,
  limit: i32,
  offset: i32,
  cwd: Option<String>,
) -> anyhow::Result<ArrowData> {
  if let Some(current_dir) = cwd {
    let _ = set_current_dir(current_dir);
  }
  info!("current_dir: {}", current_dir()?.display());
  let con = if path == ":memory:" {
    Connection::open_in_memory()
  } else {
    Connection::open(path)
  };
  let db = con.map_err(|err| anyhow!("Failed to open database connection: {}", err))?;

  println!("sql: {}", sql);

  // get total row count
  let count_sql = format!("select count(1) from ({sql})");
  let total_count: u64 = db.query_row(count_sql.as_str(), [], |row| row.get(0))?;

  // query
  let sql = format!("{sql} limit {limit} offset {offset}");
  let mut stmt = db.prepare(sql.as_str())?;
  let frames = stmt.query_arrow(duckdb::params![])?;
  println!("sql: {}", sql);
  let schema = frames.get_schema();
  let records: Vec<RecordBatch> = frames.collect();

  let record_batch = arrow::compute::concat_batches(&schema, &records)?;

  Ok(ArrowData {
    total_count,
    preview: serialize_preview(&record_batch)?,
  })
}

pub fn show_db_information(path: String, sql: &str) -> anyhow::Result<ArrowData> {
  let db = Connection::open(path)?;
  let mut stmt = db.prepare(sql).unwrap();
  let frames = stmt.query_arrow(duckdb::params![]).unwrap();
  let schema = frames.get_schema();
  let records: Vec<RecordBatch> = frames.collect();
  let record_batch = arrow::compute::concat_batches(&schema, &records).unwrap();
  Ok(ArrowData {
    total_count: records.len() as u64,
    preview: serialize_preview(&record_batch).unwrap(),
  })
}

pub fn show_tables(path: String) -> anyhow::Result<ArrowData> {
  show_db_information(
    path,
    "select * from information_schema.tables order by table_type, table_name",
  )
}

pub fn show_columns(path: String) -> anyhow::Result<ArrowData> {
  show_db_information(
    path,
    "select * from information_schema.columns order by table_type, table_name",
  )
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileNode {
  name: String,
  path: String,
  is_dir: bool,
  children: Option<Vec<FileNode>>,
  file_type: Option<String>,
}

pub fn directory_tree(path: &str) -> Option<FileNode> {
  let _path = Path::new(path);
  let name = _path.file_name().unwrap().to_string_lossy().to_string();

  if name.starts_with("~$") && name.ends_with(".xlsx") {
    return None;
  }

  let support_types = vec!["csv", "xlsx", "parquet"];

  let is_dir = _path.is_dir();
  let file_type = if is_dir {
    None
  } else {
    let file_ext = _path.extension().unwrap().to_string_lossy().to_string();
    if !support_types.contains(&file_ext.as_str()) {
      return None;
    }
    Some(file_ext)
  };

  let mut children = None;

  if is_dir {
    if let Ok(entries) = fs::read_dir(path) {
      let mut child_nodes = Vec::new();
      for entry in entries {
        if let Ok(entry) = entry {
          let child_path = entry.path();
          if let Some(child_node) = directory_tree(child_path.to_str().unwrap()) {
            child_nodes.push(child_node);
          }
        }
      }
      children = Some(child_nodes);
    }
  }

  Some(FileNode {
    name,
    path: path.to_string().replace("\\", "/"),
    is_dir,
    children,
    file_type,
  })
}
