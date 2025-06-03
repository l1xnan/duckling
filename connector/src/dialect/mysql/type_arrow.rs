use std::sync::Arc;
use arrow::array::{ArrayRef, Float64Array, Int64Array, StringArray};
use mysql::{from_value, Value};
use mysql::consts::ColumnType;
use mysql::consts::ColumnType::{MYSQL_TYPE_BLOB, MYSQL_TYPE_DATE, MYSQL_TYPE_DATETIME, MYSQL_TYPE_DECIMAL, MYSQL_TYPE_DOUBLE, MYSQL_TYPE_FLOAT, MYSQL_TYPE_INT24, MYSQL_TYPE_LONG, MYSQL_TYPE_LONGLONG, MYSQL_TYPE_NEWDECIMAL, MYSQL_TYPE_SHORT, MYSQL_TYPE_STRING, MYSQL_TYPE_TINY, MYSQL_TYPE_VARCHAR, MYSQL_TYPE_VAR_STRING, MYSQL_TYPE_YEAR};

pub fn convert_to_u64_arr(values: &[Value]) -> Vec<Option<u64>> {
    values.iter().map(convert_to_u64).collect()
}

fn convert_to_str(unknown_val: &Value) -> Option<String> {
  match unknown_val {
    val @ Value::Bytes(..) => {
      let val = from_value::<Vec<u8>>(val.clone());
      String::from_utf8(val).ok()
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

fn convert_to_i32(unknown_val: &Value) -> Option<i32> {
  match unknown_val {
    val @ Value::Int(..) => {
      let val = from_value::<i32>(val.clone());
      Some(val)
    }
    _ => None,
  }
}

fn convert_to_i32_arr(values: &[Value]) -> Vec<Option<i32>> {
  values.iter().map(convert_to_i32).collect()
}

fn convert_to_u64(unknown_val: &Value) -> Option<u64> {
  match unknown_val {
    val @ Value::UInt(..) => {
      let val = from_value::<u64>(val.clone());
      Some(val)
    }
    val @ Value::Int(..) => {
      let val = from_value::<u64>(val.clone());
      Some(val)
    }
    val @ Value::Bytes(..) => {
      let val = from_value::<u64>(val.clone());
      Some(val)
    }
    _ => None,
  }
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

pub fn convert_arrow(types: Vec<ColumnType>, mut tables: Vec<Vec<Value>>) -> Vec<ArrayRef> {
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