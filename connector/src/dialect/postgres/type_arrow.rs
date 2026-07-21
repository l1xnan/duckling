use std::sync::Arc;

use arrow::array::*;
use arrow::datatypes::{DataType, Field};
use chrono::NaiveDate;
use rust_decimal::Decimal;
use tokio_postgres::types::Type;
use tokio_postgres::{Column, Row};

use crate::utils::{
  finalize_preview_batch, record_batch_from_arrays, truncate_bytes_for_preview,
  truncate_utf8_for_preview, Title,
};

pub fn col_to_arrow_type(column: &Column) -> DataType {
  match *column.type_() {
    Type::BOOL => DataType::Boolean,
    Type::INT2 | Type::INT4 | Type::INT8 => DataType::Int64,
    Type::FLOAT4 | Type::FLOAT8 => DataType::Float64,
    Type::BYTEA => DataType::Binary,
    Type::TEXT
    | Type::VARCHAR
    | Type::NAME
    | Type::BPCHAR
    | Type::JSON
    | Type::JSONB
    | Type::NUMERIC
    | Type::DATE
    | Type::TIME
    | Type::TIMESTAMP
    | Type::TIMESTAMPTZ
    | Type::UUID
    | Type::TS_VECTOR
    | Type::BOOL_ARRAY
    | Type::INT2_ARRAY
    | Type::INT4_ARRAY
    | Type::INT8_ARRAY
    | Type::FLOAT4_ARRAY
    | Type::FLOAT8_ARRAY
    | Type::TEXT_ARRAY
    | Type::VARCHAR_ARRAY
    | Type::JSON_ARRAY
    | Type::JSONB_ARRAY
    | Type::ANYENUM => DataType::Utf8,
    _ => DataType::Utf8,
  }
}

/// Convert prepared-statement rows directly into a RecordBatch (no JSON hop).
pub fn rows_to_arrow(
  columns: &[Column],
  rows: &[Row],
) -> anyhow::Result<(Vec<Title>, arrow::record_batch::RecordBatch)> {
  let mut titles = Vec::with_capacity(columns.len());
  let mut fields = Vec::with_capacity(columns.len());
  for col in columns {
    titles.push(Title {
      name: col.name().to_string(),
      r#type: col.type_().name().to_string(),
    });
    fields.push(Field::new(col.name(), col_to_arrow_type(col), true));
  }

  let mut arrays: Vec<ArrayRef> = Vec::with_capacity(columns.len());
  for (col_i, col) in columns.iter().enumerate() {
    // Build array from the same DataType used for the field (single source of truth).
    arrays.push(column_to_array(col_to_arrow_type(col), col, rows, col_i)?);
  }

  let batch = record_batch_from_arrays(fields, arrays)?;
  let batch = finalize_preview_batch(batch)?;
  Ok((titles, batch))
}

fn column_to_array(
  data_type: DataType,
  col: &Column,
  rows: &[Row],
  col_i: usize,
) -> anyhow::Result<ArrayRef> {
  // Prefer DataType dispatch so schema and array stay aligned.
  // For INT/FLOAT/BOOL/BYTEA still use PG wire type for correct try_get width.
  Ok(match data_type {
    DataType::Boolean => {
      let values: Vec<Option<bool>> = rows
        .iter()
        .map(|r| r.try_get::<_, Option<bool>>(col_i).ok().flatten())
        .collect();
      Arc::new(BooleanArray::from(values))
    }
    DataType::Int64 => match *col.type_() {
      Type::INT2 => {
        let values: Vec<Option<i64>> = rows
          .iter()
          .map(|r| {
            r.try_get::<_, Option<i16>>(col_i)
              .ok()
              .flatten()
              .map(|v| v as i64)
          })
          .collect();
        Arc::new(Int64Array::from(values))
      }
      Type::INT4 => {
        let values: Vec<Option<i64>> = rows
          .iter()
          .map(|r| {
            r.try_get::<_, Option<i32>>(col_i)
              .ok()
              .flatten()
              .map(|v| v as i64)
          })
          .collect();
        Arc::new(Int64Array::from(values))
      }
      _ => {
        let values: Vec<Option<i64>> = rows
          .iter()
          .map(|r| r.try_get::<_, Option<i64>>(col_i).ok().flatten())
          .collect();
        Arc::new(Int64Array::from(values))
      }
    },
    DataType::Float64 => match *col.type_() {
      Type::FLOAT4 => {
        let values: Vec<Option<f64>> = rows
          .iter()
          .map(|r| {
            r.try_get::<_, Option<f32>>(col_i)
              .ok()
              .flatten()
              .map(|v| v as f64)
          })
          .collect();
        Arc::new(Float64Array::from(values))
      }
      _ => {
        let values: Vec<Option<f64>> = rows
          .iter()
          .map(|r| r.try_get::<_, Option<f64>>(col_i).ok().flatten())
          .collect();
        Arc::new(Float64Array::from(values))
      }
    },
    DataType::Binary => {
      let values: Vec<Option<Vec<u8>>> = rows
        .iter()
        .map(|r| {
          r.try_get::<_, Option<Vec<u8>>>(col_i)
            .ok()
            .flatten()
            .map(|b| truncate_bytes_for_preview(&b))
        })
        .collect();
      let mut builder = BinaryBuilder::new();
      for v in values {
        match v {
          Some(bytes) => builder.append_value(bytes),
          None => builder.append_null(),
        }
      }
      Arc::new(builder.finish())
    }
    // Utf8 and everything else: multi-step string fallback (L1 → null).
    _ => Arc::new(StringArray::from(string_column(col, rows, col_i))),
  })
}

fn string_column(col: &Column, rows: &[Row], col_i: usize) -> Vec<Option<String>> {
  match *col.type_() {
    Type::NUMERIC => rows
      .iter()
      .map(|r| {
        r.try_get::<_, Option<Decimal>>(col_i)
          .ok()
          .flatten()
          .map(|d| d.to_string())
      })
      .collect(),
    Type::DATE => rows
      .iter()
      .map(|r| {
        r.try_get::<_, Option<NaiveDate>>(col_i)
          .ok()
          .flatten()
          .map(|d| d.to_string())
      })
      .collect(),
    Type::JSON | Type::JSONB => rows
      .iter()
      .map(|r| {
        r.try_get::<_, Option<serde_json::Value>>(col_i)
          .ok()
          .flatten()
          .map(|v| truncate_utf8_for_preview(&v.to_string()))
      })
      .collect(),
    _ => rows
      .iter()
      .map(|r| {
        if let Ok(v) = r.try_get::<_, Option<String>>(col_i) {
          return v.map(|s| truncate_utf8_for_preview(&s));
        }
        if let Ok(v) = r.try_get::<_, Option<serde_json::Value>>(col_i) {
          return v.map(|j| truncate_utf8_for_preview(&j.to_string()));
        }
        if let Ok(v) = r.try_get::<_, Option<Vec<u8>>>(col_i) {
          return v.map(|b| {
            let s = String::from_utf8_lossy(&truncate_bytes_for_preview(&b)).into_owned();
            truncate_utf8_for_preview(&s)
          });
        }
        None
      })
      .collect(),
  }
}
