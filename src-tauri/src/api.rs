use std::env::{current_dir, set_current_dir};

use anyhow::anyhow;
use arrow::{ipc::writer::StreamWriter, record_batch::RecordBatch};
use duckdb::Connection;
use serde::{Deserialize, Serialize};

use crate::dialect::Title;

pub struct RawArrowData {
  /// The total number of rows that were selected.
  pub total: usize,
  pub batch: RecordBatch,
  pub titles: Option<Vec<Title>>,
  pub sql: Option<String>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ArrowResponse {
  /// The total number of rows that were selected.
  pub total: usize,
  /// A preview of the first N records, serialized as an Apache Arrow array
  /// using their IPC format.
  pub data: Vec<u8>,
  pub titles: Option<Vec<Title>>,
  pub sql: Option<String>,

  pub code: i32,
  pub message: String,
}

pub fn convert(res: anyhow::Result<RawArrowData>) -> ArrowResponse {
  match res {
    Ok(raw) => match serialize_preview(&raw.batch) {
      Ok(data) => ArrowResponse {
        total: raw.total,
        sql: raw.sql,
        data,
        titles: raw.titles,
        ..ArrowResponse::default()
      },
      Err(err) => ArrowResponse {
        code: 401,
        message: err.to_string(),
        ..ArrowResponse::default()
      },
    },
    Err(err) => {
      log::error!("error:{}", err);
      ArrowResponse {
        code: 401,
        message: err.to_string(),
        ..ArrowResponse::default()
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

  let batch = arrow::compute::concat_batches(&schema, &records)?;
  let total = batch.num_rows();

  Ok(RawArrowData {
    total,
    batch,
    titles: None,
    sql: Some(sql.to_string()),
  })
}
