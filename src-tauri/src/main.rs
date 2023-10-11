// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use arrow::{ipc::writer::StreamWriter, record_batch::RecordBatch};
use std::fmt::format;

use duckdb::{params, Connection, Result};

use duckdb::arrow::util::pretty::print_batches;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ValidationResponse {
  /// The total number of rows that were selected.
  pub row_count: usize,
  /// A preview of the first N records, serialized as an Apache Arrow array
  /// using their IPC format.
  pub preview: Vec<u8>,
}

#[tauri::command]
fn greet(name: &str) -> String {
  format!("Hello, {}! You've been greeted from Rust!", name)
}

fn serialize_preview(record: &RecordBatch) -> Result<Vec<u8>, arrow::error::ArrowError> {
  let mut writer = StreamWriter::try_new(Vec::new(), &record.schema())?;
  writer.write(record)?;
  writer.into_inner()
}

#[tauri::command]
async fn read_parquet(path: String) -> ValidationResponse {
  let db = Connection::open_in_memory().unwrap();

  let sql = format!("select * from read_parquet('{}')", path);
  let mut stmt = db.prepare(sql.as_str()).unwrap();

  let frames = stmt.query_arrow(duckdb::params![]).unwrap();

  let schema = frames.get_schema();

  let records: Vec<RecordBatch> = frames.collect();

  let row_count = stmt.row_count();
  let record_batch = arrow::compute::concat_batches(&schema, &records).unwrap();

  ValidationResponse {
    row_count,
    preview: serialize_preview(&record_batch).unwrap(),
  }
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![greet, read_parquet])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
