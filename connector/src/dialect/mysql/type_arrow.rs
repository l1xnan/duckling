use arrow::array::{ArrayRef, Float64Array, Int64Array, StringArray};
use arrow::datatypes::{DataType, Field};
use mysql::consts::ColumnType;
use mysql::consts::ColumnType::*;
use mysql::{Column, Value, from_value};
use std::sync::Arc;

/// Keep preview cells bounded so tables with large TEXT/BLOB columns do not OOM.
const MAX_CELL_BYTES: usize = crate::utils::MAX_PREVIEW_CELL_BYTES;

fn truncate_bytes(bytes: &[u8], max: usize) -> Vec<u8> {
  if bytes.len() <= max {
    bytes.to_vec()
  } else {
    bytes[..max].to_vec()
  }
}

fn convert_to_str(unknown_val: &Value) -> Option<String> {
  match unknown_val {
    val @ Value::Bytes(..) => {
      let val = from_value::<Vec<u8>>(val.clone());
      let val = truncate_bytes(&val, MAX_CELL_BYTES);
      match String::from_utf8(val) {
        Ok(s) => Some(s),
        Err(e) => Some(String::from_utf8_lossy(e.as_bytes()).into_owned()),
      }
    }
    Value::NULL => None,
    other => Some(format!("{other:?}")),
  }
}

pub fn convert_to_str_arr(values: &[Value]) -> Vec<Option<String>> {
  values.iter().map(convert_to_str).collect()
}

fn convert_to_i64(unknown_val: &Value) -> Option<i64> {
  match unknown_val {
    val @ Value::Int(..) => Some(from_value::<i64>(val.clone())),
    val @ Value::UInt(..) => Some(from_value::<i64>(val.clone())),
    val @ Value::Bytes(..) => Some(from_value::<i64>(val.clone())),
    _ => None,
  }
}

pub fn convert_to_i64_arr(values: &[Value]) -> Vec<Option<i64>> {
  values.iter().map(convert_to_i64).collect()
}

fn convert_to_f64(unknown_val: &Value) -> Option<f64> {
  match unknown_val {
    val @ Value::Float(..) => Some(from_value::<f64>(val.clone())),
    val @ Value::Double(..) => Some(from_value::<f64>(val.clone())),
    val @ Value::Bytes(..) => Some(from_value::<f64>(val.clone())),
    _ => None,
  }
}

pub fn convert_to_f64_arr(values: &[Value]) -> Vec<Option<f64>> {
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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn schema_and_array_types_agree_for_text_like_columns() {
    // These used to map schema→Binary while convert_arrow built Utf8 arrays.
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
}
