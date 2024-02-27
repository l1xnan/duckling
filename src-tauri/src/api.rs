use std::env::{current_dir, set_current_dir};

use anyhow::anyhow;
use arrow::{ipc::writer::StreamWriter, record_batch::RecordBatch};
use duckdb::Connection;
use serde::{Deserialize, Serialize};
use tokio_postgres::types::IsNull::No;

use crate::dialect::Title;

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct ArrowData {
  /// The total number of rows that were selected.
  pub total_count: usize,
  /// A preview of the first N records, serialized as an Apache Arrow array
  /// using their IPC format.
  pub preview: Vec<u8>,
  pub titles: Option<Vec<Title>>,
}

pub struct RawArrowData {
  /// The total number of rows that were selected.
  pub total_count: usize,
  pub batch: RecordBatch,
  pub titles: Option<Vec<Title>>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ArrowResponse {
  /// The total number of rows that were selected.
  pub total: usize,
  /// A preview of the first N records, serialized as an Apache Arrow array
  /// using their IPC format.
  pub data: Vec<u8>,
  pub titles: Option<Vec<Title>>,

  pub code: i32,
  pub message: String,
}

pub fn convert(res: anyhow::Result<RawArrowData>) -> ArrowResponse {
  match res {
    Ok(raw) => match serialize_preview(&raw.batch) {
      Ok(data) => ArrowResponse {
        total: raw.total_count,
        data,
        titles: raw.titles,
        code: 0,
        message: String::new(),
      },
      Err(err) => ArrowResponse {
        total: 0,
        data: vec![],
        titles: None,
        code: 401,
        message: err.to_string(),
      },
    },
    Err(err) => {
      log::error!("error:{}", err);
      ArrowResponse {
        total: 0,
        data: vec![],
        titles: None,
        code: 401,
        message: err.to_string(),
      }
    }
  }
}

pub fn serialize_preview(record: &RecordBatch) -> Result<Vec<u8>, arrow::error::ArrowError> {
  let mut writer = StreamWriter::try_new(Vec::new(), &record.schema())?;
  writer.write(record)?;
  writer.into_inner()
}

pub fn fetch_all(path: &str, sql: &str, cwd: Option<String>) -> anyhow::Result<RecordBatch> {
  if let Some(cwd) = &cwd {
    let _ = set_current_dir(cwd);
  }
  log::info!("current_dir: {}", current_dir()?.display());
  let con = if path == ":memory:" {
    Connection::open_in_memory()
  } else {
    Connection::open(path)
  };
  let db = con.map_err(|err| anyhow!("Failed to open database connection: {}", err))?;
  let mut stmt = db.prepare(sql)?;
  let frames = stmt.query_arrow(duckdb::params![])?;
  let schema = frames.get_schema();
  let records: Vec<_> = frames.collect();
  Ok(arrow::compute::concat_batches(&schema, &records)?)
}

pub fn query(
  path: &str,
  sql: &str,
  limit: usize,
  offset: usize,
  cwd: Option<String>,
) -> anyhow::Result<RawArrowData> {
  if let Some(cwd) = &cwd {
    let _ = set_current_dir(cwd);
  }
  log::info!("current_dir: {}", current_dir()?.display());
  let con = if path == ":memory:" {
    Connection::open_in_memory()
  } else {
    Connection::open(path)
  };
  let db = con.map_err(|err| anyhow!("Failed to open database connection: {}", err))?;

  println!("sql: {}", sql);

  // query
  let mut stmt = db.prepare(sql)?;

  // let titles: Vec<_> = stmt
  //   .column_names()
  //   .iter()
  //   .enumerate()
  //   .map(|(i, name)| Title {
  //     name: name.clone(),
  //     r#type: stmt.column_type(i).to_string(),
  //   })
  //   .collect();

  let frames = stmt.query_arrow(duckdb::params![])?;
  let schema = frames.get_schema();
  let records: Vec<_> = frames.collect();

  let record_batch = arrow::compute::concat_batches(&schema, &records)?;
  let total = record_batch.num_rows();
  let batch = record_batch.slice(offset, std::cmp::min(limit, total - offset));

  Ok(RawArrowData {
    total_count: total,
    batch,
    titles: None,
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
    total_count: records.len(),
    preview: serialize_preview(&record_batch).unwrap(),
    titles: None,
  })
}

pub fn show_columns(path: String) -> anyhow::Result<ArrowData> {
  show_db_information(
    path,
    "select * from information_schema.columns order by table_type, table_name",
  )
}
