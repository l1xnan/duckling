//! Postgres → [`PreviewGrid`] decoder (Phase 3 IR).

use chrono::NaiveDate;
use rust_decimal::Decimal;
use tokio_postgres::types::Type;
use tokio_postgres::{Column, Row};

use crate::preview::{LogicalKind, PreviewCell, PreviewColumn, PreviewGrid};
use crate::utils::{truncate_bytes_for_preview, truncate_utf8_for_preview};

pub fn column_kind(col: &Column) -> LogicalKind {
  match *col.type_() {
    Type::BOOL => LogicalKind::Bool,
    Type::INT2 | Type::INT4 | Type::INT8 => LogicalKind::Int,
    Type::FLOAT4 | Type::FLOAT8 => LogicalKind::Float,
    Type::BYTEA => LogicalKind::Bytes,
    _ => LogicalKind::Text,
  }
}

fn decode_cell(col: &Column, row: &Row, col_i: usize, kind: LogicalKind) -> PreviewCell {
  match kind {
    LogicalKind::Bool => row
      .try_get::<_, Option<bool>>(col_i)
      .ok()
      .flatten()
      .map(PreviewCell::Bool)
      .unwrap_or(PreviewCell::Null),
    LogicalKind::Int => match *col.type_() {
      Type::INT2 => row
        .try_get::<_, Option<i16>>(col_i)
        .ok()
        .flatten()
        .map(|v| PreviewCell::Int(v as i64))
        .unwrap_or(PreviewCell::Null),
      Type::INT4 => row
        .try_get::<_, Option<i32>>(col_i)
        .ok()
        .flatten()
        .map(|v| PreviewCell::Int(v as i64))
        .unwrap_or(PreviewCell::Null),
      _ => row
        .try_get::<_, Option<i64>>(col_i)
        .ok()
        .flatten()
        .map(PreviewCell::Int)
        .unwrap_or(PreviewCell::Null),
    },
    LogicalKind::Float => match *col.type_() {
      Type::FLOAT4 => row
        .try_get::<_, Option<f32>>(col_i)
        .ok()
        .flatten()
        .map(|v| PreviewCell::Float(v as f64))
        .unwrap_or(PreviewCell::Null),
      _ => row
        .try_get::<_, Option<f64>>(col_i)
        .ok()
        .flatten()
        .map(PreviewCell::Float)
        .unwrap_or(PreviewCell::Null),
    },
    LogicalKind::Bytes => row
      .try_get::<_, Option<Vec<u8>>>(col_i)
      .ok()
      .flatten()
      .map(|b| PreviewCell::Bytes(truncate_bytes_for_preview(&b)))
      .unwrap_or(PreviewCell::Null),
    LogicalKind::Text | LogicalKind::Unknown => decode_text(col, row, col_i),
  }
}

fn decode_text(col: &Column, row: &Row, col_i: usize) -> PreviewCell {
  match *col.type_() {
    Type::NUMERIC => row
      .try_get::<_, Option<Decimal>>(col_i)
      .ok()
      .flatten()
      .map(|d| PreviewCell::Text(d.to_string()))
      .unwrap_or(PreviewCell::Null),
    Type::DATE => row
      .try_get::<_, Option<NaiveDate>>(col_i)
      .ok()
      .flatten()
      .map(|d| PreviewCell::Text(d.to_string()))
      .unwrap_or(PreviewCell::Null),
    Type::JSON | Type::JSONB => row
      .try_get::<_, Option<serde_json::Value>>(col_i)
      .ok()
      .flatten()
      .map(|v| PreviewCell::Text(truncate_utf8_for_preview(&v.to_string())))
      .unwrap_or(PreviewCell::Null),
    _ => {
      if let Ok(v) = row.try_get::<_, Option<String>>(col_i) {
        return v
          .map(|s| PreviewCell::Text(truncate_utf8_for_preview(&s)))
          .unwrap_or(PreviewCell::Null);
      }
      if let Ok(v) = row.try_get::<_, Option<serde_json::Value>>(col_i) {
        return v
          .map(|j| PreviewCell::Text(truncate_utf8_for_preview(&j.to_string())))
          .unwrap_or(PreviewCell::Null);
      }
      if let Ok(v) = row.try_get::<_, Option<Vec<u8>>>(col_i) {
        return v
          .map(|b| {
            let t = truncate_bytes_for_preview(&b);
            PreviewCell::Text(truncate_utf8_for_preview(&String::from_utf8_lossy(&t)))
          })
          .unwrap_or(PreviewCell::Null);
      }
      PreviewCell::Null
    }
  }
}

/// Decode prepared-statement rows into [`PreviewGrid`].
pub fn rows_to_grid(columns: &[Column], rows: &[Row], sql: &str) -> PreviewGrid {
  let mut cols: Vec<PreviewColumn> = columns
    .iter()
    .map(|c| {
      PreviewColumn::new(
        c.name().to_string(),
        c.type_().name().to_string(),
        column_kind(c),
      )
    })
    .collect();

  for row in rows {
    for (col_i, col) in cols.iter_mut().enumerate() {
      let kind = col.kind;
      col.push(decode_cell(&columns[col_i], row, col_i, kind));
    }
  }

  PreviewGrid {
    columns: cols,
    sql: Some(sql.to_string()),
    total: None,
  }
}
