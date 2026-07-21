use connector::utils;
use connector::utils::{RawArrowData, Title};
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

impl ArrowResponse {
  /// `sql` is attached on error responses so the UI can still show the failed statement.
  /// On success, `raw.sql` takes precedence when present.
  pub fn from_raw_data(
    res: anyhow::Result<RawArrowData>,
    elapsed: Option<u128>,
    sql: Option<String>,
  ) -> ArrowResponse {
    match res {
      Ok(raw) => match utils::serialize_preview(&raw.batch) {
        Ok(data) => ArrowResponse {
          total: raw.total,
          sql: raw.sql.or(sql),
          data,
          elapsed,
          titles: raw.titles,
          ..Self::default()
        },
        Err(err) => ArrowResponse {
          code: 401,
          elapsed,
          message: err.to_string(),
          sql,
          ..Self::default()
        },
      },
      Err(err) => {
        log::error!("Error processing RawArrowData: {}", err);
        let (code, message) = connector::error::arrow_error_parts(&err);
        ArrowResponse {
          code,
          elapsed,
          message,
          sql,
          ..Self::default()
        }
      }
    }
  }
}
