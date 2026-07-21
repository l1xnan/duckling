use std::sync::Arc;

use arrow::array::*;
use arrow::datatypes::{DataType, Field, Schema};
use arrow::record_batch::RecordBatch;
use chrono::NaiveDate;
use rust_decimal::Decimal;
use tokio_postgres::types::Type;
use tokio_postgres::{Column, Row};

use crate::utils::{Title, MAX_PREVIEW_CELL_BYTES};

fn truncate_str(s: String) -> String {
  if s.len() <= MAX_PREVIEW_CELL_BYTES {
    return s;
  }
  let mut end = MAX_PREVIEW_CELL_BYTES.min(s.len());
  while end > 0 && !s.is_char_boundary(end) {
    end -= 1;
  }
  let mut out = s[..end].to_string();
  out.push('…');
  out
}

fn truncate_bytes(bytes: Vec<u8>) -> Vec<u8> {
  if bytes.len() <= MAX_PREVIEW_CELL_BYTES {
    bytes
  } else {
    bytes[..MAX_PREVIEW_CELL_BYTES].to_vec()
  }
}

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
) -> anyhow::Result<(Vec<Title>, RecordBatch)> {
  let mut titles = Vec::with_capacity(columns.len());
  let mut fields = Vec::with_capacity(columns.len());
  for col in columns {
    titles.push(Title {
      name: col.name().to_string(),
      r#type: col.type_().name().to_string(),
    });
    fields.push(Field::new(col.name(), col_to_arrow_type(col), true));
  }
  let schema = Arc::new(Schema::new(fields));

  let mut arrays: Vec<ArrayRef> = Vec::with_capacity(columns.len());
  for (col_i, col) in columns.iter().enumerate() {
    arrays.push(column_to_array(col, rows, col_i)?);
  }

  let batch = RecordBatch::try_new(schema, arrays)?;
  Ok((titles, batch))
}

fn column_to_array(col: &Column, rows: &[Row], col_i: usize) -> anyhow::Result<ArrayRef> {
  Ok(match *col.type_() {
    Type::BOOL => {
      let values: Vec<Option<bool>> = rows
        .iter()
        .map(|r| r.try_get::<_, Option<bool>>(col_i).ok().flatten())
        .collect();
      Arc::new(BooleanArray::from(values))
    }
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
    Type::INT8 => {
      let values: Vec<Option<i64>> = rows
        .iter()
        .map(|r| r.try_get::<_, Option<i64>>(col_i).ok().flatten())
        .collect();
      Arc::new(Int64Array::from(values))
    }
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
    Type::FLOAT8 => {
      let values: Vec<Option<f64>> = rows
        .iter()
        .map(|r| r.try_get::<_, Option<f64>>(col_i).ok().flatten())
        .collect();
      Arc::new(Float64Array::from(values))
    }
    Type::BYTEA => {
      let values: Vec<Option<Vec<u8>>> = rows
        .iter()
        .map(|r| {
          r.try_get::<_, Option<Vec<u8>>>(col_i)
            .ok()
            .flatten()
            .map(truncate_bytes)
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
    Type::NUMERIC => {
      let values: Vec<Option<String>> = rows
        .iter()
        .map(|r| {
          r.try_get::<_, Option<Decimal>>(col_i)
            .ok()
            .flatten()
            .map(|d| d.to_string())
        })
        .collect();
      Arc::new(StringArray::from(values))
    }
    Type::DATE => {
      let values: Vec<Option<String>> = rows
        .iter()
        .map(|r| {
          r.try_get::<_, Option<NaiveDate>>(col_i)
            .ok()
            .flatten()
            .map(|d| d.to_string())
        })
        .collect();
      Arc::new(StringArray::from(values))
    }
    Type::JSON | Type::JSONB => {
      let values: Vec<Option<String>> = rows
        .iter()
        .map(|r| {
          r.try_get::<_, Option<serde_json::Value>>(col_i)
            .ok()
            .flatten()
            .map(|v| truncate_str(v.to_string()))
        })
        .collect();
      Arc::new(StringArray::from(values))
    }
    _ => {
      // Prefer String; fall back to Display via try_get String.
      let values: Vec<Option<String>> = rows
        .iter()
        .map(|r| {
          if let Ok(v) = r.try_get::<_, Option<String>>(col_i) {
            return v.map(truncate_str);
          }
          // last resort: empty/null
          None
        })
        .collect();
      Arc::new(StringArray::from(values))
    }
  })
}
