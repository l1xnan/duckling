use crate::utils;
use crate::utils::{RawArrowData, Title};
use serde::{Deserialize, Serialize};

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
  pub elapsed: Option<u128>,
}

pub fn convert(res: anyhow::Result<RawArrowData>, elapsed: Option<u128>) -> ArrowResponse {
  match res {
    Ok(raw) => match utils::serialize_preview(&raw.batch) {
      Ok(data) => ArrowResponse {
        total: raw.total,
        sql: raw.sql,
        data,
        elapsed,
        titles: raw.titles,
        ..ArrowResponse::default()
      },
      Err(err) => ArrowResponse {
        code: 401,
        elapsed,
        message: err.to_string(),
        ..ArrowResponse::default()
      },
    },
    Err(err) => {
      log::error!("error:{}", err);
      ArrowResponse {
        code: 401,
        elapsed,
        message: err.to_string(),
        ..ArrowResponse::default()
      }
    }
  }
}
