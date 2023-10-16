use anyhow::anyhow;
use arrow::{ipc::writer::StreamWriter, record_batch::RecordBatch};
use duckdb::Connection;
use std::path::Path;
use tauri::Manager;

use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct ValidationResponse {
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

pub fn convert(res: anyhow::Result<ValidationResponse>) -> ArrowResponse {
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
) -> anyhow::Result<ValidationResponse> {
  let con = if path == ":memory:" {
    Connection::open_in_memory()
  } else {
    Connection::open(path)
  };
  let db = con.map_err(|err| anyhow!("Failed to open database connection: {}", err))?;

  println!("sql: {}", sql);

  // get total row count
  let count_sql = format!("select count(1) from ({sql})");
  let total_count: u64 = db
    .query_row(count_sql.as_str(), [], |row| row.get(0))
    .unwrap();

  // query
  let sql = format!("{sql} limit {limit} offset {offset}");
  let mut stmt = db.prepare(sql.as_str()).unwrap();
  let frames = stmt.query_arrow(duckdb::params![]).unwrap();
  println!("sql: {}", sql);
  let schema = frames.get_schema();
  let records: Vec<RecordBatch> = frames.collect();

  let record_batch = arrow::compute::concat_batches(&schema, &records).unwrap();

  Ok(ValidationResponse {
    total_count,
    preview: serialize_preview(&record_batch).unwrap(),
  })
}

pub fn show_tables(path: String) -> anyhow::Result<ValidationResponse> {
  let db = Connection::open(path)?;
  let mut stmt = db.prepare("SHOW TABLES").unwrap();
  let frames = stmt.query_arrow(duckdb::params![]).unwrap();
  let schema = frames.get_schema();
  let records: Vec<RecordBatch> = frames.collect();
  let record_batch = arrow::compute::concat_batches(&schema, &records).unwrap();
  Ok(ValidationResponse {
    total_count: records.len() as u64,
    preview: serialize_preview(&record_batch).unwrap(),
  })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileNode {
  name: String,
  path: String,
  is_dir: bool,
  children: Vec<FileNode>,
}

pub fn directory_tree(path: &str) -> FileNode {
  let mut node = FileNode {
    path: path.to_string().replace("\\", "/"),
    name: Path::new(path)
      .file_name()
      .unwrap()
      .to_string_lossy()
      .to_string(),
    is_dir: Path::new(path).is_dir(),
    children: Vec::new(),
  };

  if let Ok(entries) = fs::read_dir(path) {
    for entry in entries {
      if let Ok(entry) = entry {
        let path = entry.path();
        if path.is_dir() {
          let child_node = directory_tree(path.to_str().unwrap());
          node.children.push(child_node);
        } else {
          node.children.push(FileNode {
            path: path.display().to_string().replace("\\", "/"),
            name: path.file_name().unwrap().to_string_lossy().to_string(),
            is_dir: false,
            children: Vec::new(),
          });
        }
      }
    }
  }

  node
}
