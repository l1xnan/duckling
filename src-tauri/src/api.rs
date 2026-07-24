use connector::utils;
use connector::utils::{RawArrowData, Title};
use serde::{Deserialize, Serialize};

/// Preview payload format for query results.
/// - `arrow`: IPC bytes in `data` (default, backward compatible)
/// - `rows`: JSON row objects in `rows` (+ `columns` / `titles`)
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PreviewFormat {
  #[default]
  Arrow,
  Rows,
}

/// sqlparser failure location relative to the executed (pre-limit-wrap) SQL.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqlParseLocationDto {
  /// 1-based line within the SQL string that was executed.
  pub line: u64,
  /// 1-based column within that line.
  pub column: u64,
  /// Optional sqlparser error summary.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub message: Option<String>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ArrowResponse {
  /// The total number of rows that were selected.
  pub total: usize,
  /// Apache Arrow IPC bytes when `format` is `arrow`.
  pub data: Vec<u8>,
  pub titles: Option<Vec<Title>>,
  pub sql: Option<String>,

  pub code: i32,
  pub message: String,
  pub elapsed: Option<u128>,

  /// When query fails and the original SQL does not parse, location for editor markers.
  #[serde(
    default,
    skip_serializing_if = "Option::is_none",
    rename = "parseLocation",
    alias = "parse_location"
  )]
  pub parse_location: Option<SqlParseLocationDto>,

  /// Preview encoding. Omitted/`arrow` keeps legacy clients working.
  #[serde(default)]
  pub format: PreviewFormat,

  /// Column metadata for `format=rows` (also mirrored into `titles` when possible).
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub columns: Option<Vec<Title>>,

  /// Row objects for `format=rows`.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub rows: Option<Vec<serde_json::Map<String, serde_json::Value>>>,
}

impl ArrowResponse {
  /// Build a response from dialect query output.
  ///
  /// Success path prefers Arrow IPC. If serialization fails but the batch has
  /// rows, fall back to `format=rows` so the UI can still render the preview.
  /// `sql` is attached on error responses so the UI can show the failed statement.
  pub fn from_raw_data(
    res: anyhow::Result<RawArrowData>,
    elapsed: Option<u128>,
    sql: Option<String>,
  ) -> ArrowResponse {
    Self::from_raw_data_with_dialect(res, elapsed, sql, None)
  }

  /// Same as [`from_raw_data`], optionally attaching sqlparser location for the user SQL.
  pub fn from_raw_data_with_dialect(
    res: anyhow::Result<RawArrowData>,
    elapsed: Option<u128>,
    sql: Option<String>,
    dialect: Option<&str>,
  ) -> ArrowResponse {
    match res {
      Ok(raw) => {
        let sql = raw.sql.clone().or(sql);
        let titles = raw.titles.clone();
        match utils::serialize_preview(&raw.batch) {
          Ok(data) => ArrowResponse {
            total: raw.total,
            sql,
            data,
            elapsed,
            titles,
            format: PreviewFormat::Arrow,
            ..Self::default()
          },
          Err(err) => {
            log::warn!(
              "Arrow IPC serialize failed ({err}); falling back to rows preview"
            );
            match utils::batch_to_preview_rows(&raw.batch) {
              Ok(payload) => {
                let columns = if let Some(t) = titles.clone() {
                  // Prefer native type titles from the dialect when present.
                  if t.len() == payload.columns.len() {
                    t
                  } else {
                    payload.columns.clone()
                  }
                } else {
                  payload.columns.clone()
                };
                ArrowResponse {
                  total: raw.total,
                  sql,
                  elapsed,
                  titles: Some(columns.clone()),
                  format: PreviewFormat::Rows,
                  columns: Some(columns),
                  rows: Some(payload.rows),
                  message: format!("preview fell back to rows: {err}"),
                  code: 0,
                  data: Vec::new(),
                  parse_location: None,
                }
              }
              Err(rows_err) => ArrowResponse {
                code: 401,
                elapsed,
                message: format!(
                  "Arrow IPC failed ({err}); rows fallback failed ({rows_err})"
                ),
                sql,
                format: PreviewFormat::Arrow,
                ..Self::default()
              },
            }
          }
        }
      }
      Err(err) => {
        log::error!("Error processing RawArrowData: {}", err);
        let (code, message) = connector::error::arrow_error_parts(&err);
        let parse_location = sql.as_deref().and_then(|s| {
          let d = dialect.unwrap_or("generic");
          connector::dialect::ast::locate_sql_parse_error(d, s).map(|loc| {
            SqlParseLocationDto {
              line: loc.line,
              column: loc.column,
              message: Some(loc.message),
            }
          })
        });
        ArrowResponse {
          code,
          elapsed,
          message,
          sql,
          parse_location,
          format: PreviewFormat::Arrow,
          ..Self::default()
        }
      }
    }
  }

  /// Build a rows-format success response directly (no Arrow path).
  #[allow(dead_code)]
  pub fn from_preview_rows(
    payload: utils::PreviewRowsPayload,
    total: usize,
    elapsed: Option<u128>,
    sql: Option<String>,
    titles: Option<Vec<Title>>,
  ) -> ArrowResponse {
    let columns = titles.unwrap_or_else(|| payload.columns.clone());
    ArrowResponse {
      total,
      sql,
      elapsed,
      titles: Some(columns.clone()),
      format: PreviewFormat::Rows,
      columns: Some(columns),
      rows: Some(payload.rows),
      code: 0,
      message: String::new(),
      data: Vec::new(),
      parse_location: None,
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn from_raw_data_error_keeps_sql() {
    let res = ArrowResponse::from_raw_data(
      Err(anyhow::anyhow!("sql error: syntax")),
      Some(1),
      Some("select bad".into()),
    );
    assert_ne!(res.code, 0);
    assert_eq!(res.sql.as_deref(), Some("select bad"));
    assert!(res.message.contains("sql") || !res.message.is_empty());
  }

  #[test]
  fn from_preview_rows_sets_format() {
    let payload = utils::PreviewRowsPayload {
      columns: vec![Title {
        name: "c".into(),
        r#type: "text".into(),
      }],
      rows: vec![{
        let mut m = serde_json::Map::new();
        m.insert("c".into(), serde_json::Value::String("v".into()));
        m
      }],
    };
    let res = ArrowResponse::from_preview_rows(payload, 1, Some(2), Some("s".into()), None);
    assert_eq!(res.format, PreviewFormat::Rows);
    assert_eq!(res.code, 0);
    assert!(res.data.is_empty());
    assert_eq!(res.rows.as_ref().map(|r| r.len()), Some(1));
    assert_eq!(res.sql.as_deref(), Some("s"));
  }
}
