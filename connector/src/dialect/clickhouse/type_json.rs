use clickhouse_rs::types::ColumnType;
use clickhouse_rs::types::Value;
use clickhouse_rs::Block;
use serde_json::{json, Value as JsonValue};
use std::collections::HashMap;

pub fn block_to_json<K: ColumnType>(block: &Block<K>) {
  let mut json_blocks: Vec<JsonValue> = Vec::new();
  let mut json_block: Vec<HashMap<String, JsonValue>> = Vec::new();
  for row in block.rows() {
    let mut row_json: HashMap<String, JsonValue> = HashMap::new();
    for i in 0..row.len() {
      let value: Value = row.get(i).unwrap();

      // let value = convert_value(value);
      let name = row.name(i).unwrap().to_string();

      // row_json.insert(name, value);
      // json_block.push(row_json);
    }
    json_blocks.push(json!(json_block));
  }
  let final_json = json!(json_blocks);
}

pub fn convert_value(value: Value) -> JsonValue {
  match value {
    Value::Bool(b) => {
      json!(b)
    }
    Value::UInt8(u) => {
      json! {u}
    }
    Value::UInt16(u) => {
      json! {u}
    }
    Value::UInt32(u) => {
      json! {u}
    }
    Value::UInt64(u) => {
      json! {u}
    }
    Value::UInt128(u) => {
      json! {u}
    }
    Value::Int8(u) => {
      json! {u}
    }
    Value::Int16(u) => {
      json! {u}
    }
    Value::Int32(u) => {
      json! {u}
    }
    Value::Int64(u) => {
      json! {u}
    }
    Value::Int128(u) => {
      json! {u}
    }
    Value::String(u) => {
      json! {u}
    }
    Value::Float32(u) => {
      json! {u}
    }
    Value::Float64(u) => {
      json! {u}
    }
    Value::Date(u) => {
      json! {u}
    }
    Value::DateTime(u, t) => {
      json! {u}
    }
    Value::DateTime64(i, (u, t)) => {
      json! {u}
    }
    Value::ChronoDateTime(u) => {
      json! {u}
    }
    Value::Ipv4(u) => {
      json! {u}
    }
    Value::Ipv6(u) => {
      json! {u}
    }
    Value::Uuid(u) => {
      json! {u}
    }
    Value::Nullable(u) => {
      json! {u}
    }
    Value::Array(t, v) => {
      let vals = v.map(|v| convert_value(v));
      json! {vals}
    }
    Value::Decimal(u) => {
      json! {u}
    }
    Value::Enum8(v, e) => {
      let vals = v.map(|v| convert_value(v));
      json! {vals}
    }
    Value::Enum16(v, e) => {
      let vals = v.map(|v| convert_value(v));
      json! {vals}
    }
    Value::Map(t1, t2, u) => {
      json! {u}
    }
    _ => {
      json! {null}
    }
  }
}
