use arrow::array::{ArrayRef, Float64Array, Int64Array, StringArray};
use arrow::datatypes::{DataType, Field};
use mysql::consts::ColumnType;
use mysql::consts::ColumnType::*;
use mysql::{Column, Value, from_value};
use mysql::{Value as MysqlValue, from_value_opt};
use std::sync::Arc;

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

pub fn get_fields(columns: &[Column]) -> (Vec<Field>, Vec<ColumnType>) {
  let mut fields = vec![];
  let mut types = vec![];
  for (i, col) in columns.iter().enumerate() {
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

trait ArrowValue<T> {
  // T is the target Option inner type
  fn as_any(&self) -> Option<T>;
}

impl ArrowValue<String> for MysqlValue {
  fn as_any(&self) -> Option<String> {
    match self {
      Value::Bytes(_) => from_value_opt::<Vec<u8>>(self.clone())
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok()),
      _ => None, // 其他 Value 类型不尝试转换为 String
    }
  }
}

impl ArrowValue<i64> for MysqlValue {
  fn as_any(&self) -> Option<i64> {
    match self {
      Value::UInt(..) => Some(from_value::<i64>(self.clone())),
      Value::Int(..) => Some(from_value::<i64>(self.clone())),
      Value::Bytes(..) => Some(from_value::<i64>(self.clone())),
      _ => None,
    }
  }
}
impl ArrowValue<f64> for MysqlValue {
  fn as_any(&self) -> Option<f64> {
    match self {
      Value::Float(..) => Some(from_value::<f64>(self.clone())),
      Value::Double(..) => Some(from_value::<f64>(self.clone())),
      Value::Bytes(..) => Some(from_value::<f64>(self.clone())),
      _ => None,
    }
  }
}

pub fn convert_value_to_arrow(types: Vec<Field>, tables: Vec<Vec<Value>>) -> Vec<ArrayRef> {
  let mut arrs = vec![];
  for (type_, col) in types.iter().zip(tables) {
    let arr: ArrayRef = match type_.data_type() {
      // DataType::Int64 => Arc::new(Int64Array::from(convert_to_i64_arr(&col))),
      DataType::Int64 => Arc::new(Int64Array::from_iter(
        col.iter().map(|val_ref| val_ref.as_any()),
      )),
      DataType::Float64 => Arc::new(Float64Array::from_iter(
        col.iter().map(|val_ref| val_ref.as_any()),
      )),
      DataType::Utf8 => Arc::new(StringArray::from_iter(
        col.iter().map(<Value as ArrowValue<String>>::as_any),
      )),
      _ => Arc::new(StringArray::from(convert_to_str_arr(&col))),
    };

    arrs.push(arr);
  }
  arrs
}
