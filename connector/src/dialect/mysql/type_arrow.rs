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
        Err(e) => {
          // Lossy fallback for binary-ish blobs stored as BLOB/TEXT.
          let lossy = String::from_utf8_lossy(e.as_bytes()).into_owned();
          Some(lossy)
        }
      }
    }
    _ => None,
  }
}

pub fn convert_to_str_arr(values: &[Value]) -> Vec<Option<String>> {
  values.iter().map(convert_to_str).collect()
}

fn convert_to_i64(unknown_val: &Value) -> Option<i64> {
  match unknown_val {
    val @ Value::Int(..) => {
      let val = from_value::<i64>(val.clone());
      Some(val)
    }
    val @ Value::UInt(..) => {
      let val = from_value::<i64>(val.clone());
      Some(val)
    }
    val @ Value::Bytes(..) => {
      let val = from_value::<i64>(val.clone());
      Some(val)
    }
    _ => None,
  }
}

pub fn convert_to_i64_arr(values: &[Value]) -> Vec<Option<i64>> {
  values.iter().map(convert_to_i64).collect()
}

fn convert_to_f64(unknown_val: &Value) -> Option<f64> {
  match unknown_val {
    val @ Value::Float(..) => {
      let val = from_value::<f64>(val.clone());
      Some(val)
    }
    val @ Value::Double(..) => {
      let val = from_value::<f64>(val.clone());
      Some(val)
    }
    val @ Value::Bytes(..) => {
      let val = from_value::<f64>(val.clone());
      Some(val)
    }
    _ => None,
  }
}

pub fn convert_to_f64_arr(values: &[Value]) -> Vec<Option<f64>> {
  values.iter().map(convert_to_f64).collect()
}

pub fn get_fields(columns: &[Column]) -> (Vec<Field>, Vec<ColumnType>) {
  let mut fields = vec![];
  let mut types = vec![];
  for (_i, col) in columns.iter().enumerate() {
    types.push(col.column_type());
    let typ = match col.column_type() {
      MYSQL_TYPE_TINY | MYSQL_TYPE_INT24 | MYSQL_TYPE_SHORT | MYSQL_TYPE_LONG
      | MYSQL_TYPE_LONGLONG => DataType::Int64,
      MYSQL_TYPE_DECIMAL
      | MYSQL_TYPE_NEWDECIMAL
      | MYSQL_TYPE_FLOAT
      | MYSQL_TYPE_YEAR
      | MYSQL_TYPE_DOUBLE => DataType::Float64,
      MYSQL_TYPE_DATETIME => DataType::Utf8,
      MYSQL_TYPE_DATE => DataType::Utf8,
      MYSQL_TYPE_BLOB => DataType::Utf8,
      MYSQL_TYPE_STRING | MYSQL_TYPE_VAR_STRING | MYSQL_TYPE_VARCHAR => DataType::Utf8,
      _ => DataType::Binary,
    };
    let field = Field::new(col.name_str(), typ, true);
    fields.push(field);
  }
  (fields, types)
}

pub fn convert_arrow(types: Vec<ColumnType>, tables: Vec<Vec<Value>>) -> Vec<ArrayRef> {
  let mut arrs = vec![];
  for (type_, col) in types.iter().zip(tables) {
    let arr: ArrayRef = match type_ {
      MYSQL_TYPE_TINY | MYSQL_TYPE_INT24 | MYSQL_TYPE_SHORT | MYSQL_TYPE_LONG
      | MYSQL_TYPE_LONGLONG => Arc::new(Int64Array::from(convert_to_i64_arr(&col))),
      MYSQL_TYPE_DECIMAL
      | MYSQL_TYPE_NEWDECIMAL
      | MYSQL_TYPE_FLOAT
      | MYSQL_TYPE_YEAR
      | MYSQL_TYPE_DOUBLE => Arc::new(Float64Array::from(convert_to_f64_arr(&col))),
      MYSQL_TYPE_STRING | MYSQL_TYPE_VAR_STRING | MYSQL_TYPE_VARCHAR => {
        Arc::new(StringArray::from(convert_to_str_arr(&col)))
      }
      MYSQL_TYPE_DATETIME => Arc::new(StringArray::from(convert_to_str_arr(&col))),
      MYSQL_TYPE_DATE => Arc::new(StringArray::from(convert_to_str_arr(&col))),
      MYSQL_TYPE_BLOB => Arc::new(StringArray::from(convert_to_str_arr(&col))),
      _ => Arc::new(StringArray::from(convert_to_str_arr(&col))),
    };

    arrs.push(arr);
  }
  arrs
}

