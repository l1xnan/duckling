use arrow::array::{ArrayRef, Float64Array, Int64Array, StringArray};
use arrow::datatypes::{DataType, Field};
use mysql::consts::ColumnType;
use mysql::consts::ColumnType::*;
use mysql::{Column, Value};
use std::sync::Arc;

use crate::utils::{
  finalize_preview_batch, record_batch_from_arrays, truncate_bytes_for_preview,
  truncate_utf8_for_preview,
};

/// Safe cell decode: never panics; unreadable values become None (L1).
fn convert_to_str(unknown_val: &Value) -> Option<String> {
  match unknown_val {
    Value::NULL => None,
    Value::Bytes(bytes) => {
      let truncated = truncate_bytes_for_preview(bytes);
      let s = match String::from_utf8(truncated) {
        Ok(s) => s,
        Err(e) => String::from_utf8_lossy(e.as_bytes()).into_owned(),
      };
      Some(truncate_utf8_for_preview(&s))
    }
    Value::Int(i) => Some(i.to_string()),
    Value::UInt(u) => Some(u.to_string()),
    Value::Float(f) => Some(f.to_string()),
    Value::Double(f) => Some(f.to_string()),
    Value::Date(y, m, d, h, mi, s, us) => {
      Some(format!("{y:04}-{m:02}-{d:02} {h:02}:{mi:02}:{s:02}.{us:06}"))
    }
    Value::Time(neg, d, h, mi, s, us) => {
      let sign = if *neg { "-" } else { "" };
      Some(format!("{sign}{d} {h:02}:{mi:02}:{s:02}.{us:06}"))
    }
  }
}

fn convert_to_str_arr(values: &[Value]) -> Vec<Option<String>> {
  values.iter().map(convert_to_str).collect()
}

fn convert_to_i64(unknown_val: &Value) -> Option<i64> {
  match unknown_val {
    Value::NULL => None,
    Value::Int(i) => Some(*i),
    Value::UInt(u) => i64::try_from(*u).ok(),
    Value::Bytes(bytes) => std::str::from_utf8(bytes).ok()?.parse().ok(),
    Value::Float(f) => Some(*f as i64),
    Value::Double(f) => Some(*f as i64),
    _ => None,
  }
}

fn convert_to_i64_arr(values: &[Value]) -> Vec<Option<i64>> {
  values.iter().map(convert_to_i64).collect()
}

fn convert_to_f64(unknown_val: &Value) -> Option<f64> {
  match unknown_val {
    Value::NULL => None,
    Value::Float(f) => Some(f64::from(*f)),
    Value::Double(f) => Some(*f),
    Value::Int(i) => Some(*i as f64),
    Value::UInt(u) => Some(*u as f64),
    Value::Bytes(bytes) => std::str::from_utf8(bytes).ok()?.parse().ok(),
    _ => None,
  }
}

fn convert_to_f64_arr(values: &[Value]) -> Vec<Option<f64>> {
  values.iter().map(convert_to_f64).collect()
}

/// Map MySQL wire type → Arrow field type.
/// Must stay in sync with [`convert_arrow`]: schema Binary + array Utf8 causes
/// `column types must match schema types` when building RecordBatch.
fn mysql_to_arrow_type(col_type: ColumnType) -> DataType {
  match col_type {
    MYSQL_TYPE_TINY | MYSQL_TYPE_INT24 | MYSQL_TYPE_SHORT | MYSQL_TYPE_LONG
    | MYSQL_TYPE_LONGLONG => DataType::Int64,
    MYSQL_TYPE_DECIMAL
    | MYSQL_TYPE_NEWDECIMAL
    | MYSQL_TYPE_FLOAT
    | MYSQL_TYPE_YEAR
    | MYSQL_TYPE_DOUBLE => DataType::Float64,
    // Text/temporal/json/enum/blob variants → Utf8 (convert_arrow builds StringArray).
    MYSQL_TYPE_STRING
    | MYSQL_TYPE_VAR_STRING
    | MYSQL_TYPE_VARCHAR
    | MYSQL_TYPE_BLOB
    | MYSQL_TYPE_TINY_BLOB
    | MYSQL_TYPE_MEDIUM_BLOB
    | MYSQL_TYPE_LONG_BLOB
    | MYSQL_TYPE_JSON
    | MYSQL_TYPE_ENUM
    | MYSQL_TYPE_SET
    | MYSQL_TYPE_BIT
    | MYSQL_TYPE_GEOMETRY
    | MYSQL_TYPE_VECTOR
    | MYSQL_TYPE_DATE
    | MYSQL_TYPE_NEWDATE
    | MYSQL_TYPE_TIME
    | MYSQL_TYPE_TIME2
    | MYSQL_TYPE_DATETIME
    | MYSQL_TYPE_DATETIME2
    | MYSQL_TYPE_TIMESTAMP
    | MYSQL_TYPE_TIMESTAMP2
    | MYSQL_TYPE_NULL
    | MYSQL_TYPE_TYPED_ARRAY
    | MYSQL_TYPE_UNKNOWN => DataType::Utf8,
  }
}

pub fn get_fields(columns: &[Column]) -> (Vec<Field>, Vec<ColumnType>) {
  let mut fields = vec![];
  let mut types = vec![];
  for col in columns {
    let col_type = col.column_type();
    types.push(col_type);
    fields.push(Field::new(
      col.name_str(),
      mysql_to_arrow_type(col_type),
      true,
    ));
  }
  (fields, types)
}

pub fn convert_arrow(types: Vec<ColumnType>, tables: Vec<Vec<Value>>) -> Vec<ArrayRef> {
  let mut arrs = vec![];
  for (type_, col) in types.iter().zip(tables) {
    let arr: ArrayRef = match mysql_to_arrow_type(*type_) {
      DataType::Int64 => Arc::new(Int64Array::from(convert_to_i64_arr(&col))),
      DataType::Float64 => Arc::new(Float64Array::from(convert_to_f64_arr(&col))),
      _ => Arc::new(StringArray::from(convert_to_str_arr(&col))),
    };
    arrs.push(arr);
  }
  arrs
}

/// Build a finalized preview batch (shared schema guards + cell truncation).
pub fn build_preview_batch(
  fields: Vec<Field>,
  types: Vec<ColumnType>,
  tables: Vec<Vec<Value>>,
) -> anyhow::Result<arrow::record_batch::RecordBatch> {
  let arrays = convert_arrow(types, tables);
  let batch = record_batch_from_arrays(fields, arrays)?;
  finalize_preview_batch(batch)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn schema_and_array_types_agree_for_text_like_columns() {
    for t in [
      MYSQL_TYPE_JSON,
      MYSQL_TYPE_ENUM,
      MYSQL_TYPE_SET,
      MYSQL_TYPE_TINY_BLOB,
      MYSQL_TYPE_MEDIUM_BLOB,
      MYSQL_TYPE_LONG_BLOB,
      MYSQL_TYPE_TIMESTAMP,
      MYSQL_TYPE_TIME,
      MYSQL_TYPE_BIT,
      MYSQL_TYPE_GEOMETRY,
    ] {
      assert_eq!(
        mysql_to_arrow_type(t),
        DataType::Utf8,
        "{t:?} must be Utf8 to match StringArray"
      );
    }
  }

  #[test]
  fn numeric_types_stay_numeric() {
    assert_eq!(mysql_to_arrow_type(MYSQL_TYPE_LONG), DataType::Int64);
    assert_eq!(mysql_to_arrow_type(MYSQL_TYPE_DOUBLE), DataType::Float64);
  }

  #[test]
  fn unreadable_numeric_bytes_become_null() {
    let bad = Value::Bytes(b"not-a-number".to_vec());
    assert_eq!(convert_to_i64(&bad), None);
    assert_eq!(convert_to_f64(&bad), None);
    assert!(convert_to_str(&bad).is_some());
  }

  #[test]
  fn build_preview_batch_handles_json_like_column() {
    let fields = vec![Field::new("j", DataType::Utf8, true)];
    let types = vec![MYSQL_TYPE_JSON];
    let tables = vec![vec![Value::Bytes(br#"{"a":1}"#.to_vec()), Value::NULL]];
    let batch = build_preview_batch(fields, types, tables).unwrap();
    assert_eq!(batch.num_rows(), 2);
    assert_eq!(batch.schema().field(0).data_type(), &DataType::Utf8);
  }
}
