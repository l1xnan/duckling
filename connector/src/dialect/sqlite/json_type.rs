use crate::types::JSONRowMap;
use rusqlite::{types, Statement};
use serde_json::{json, Value};
use std::collections::HashMap;

pub fn db_result_to_json(stmt: &mut Statement) -> anyhow::Result<Vec<JSONRowMap>> {
  let names: Vec<String> = stmt
    .column_names()
    .into_iter()
    .map(|s| s.to_string())
    .collect();
  let mut result: Vec<JSONRowMap> = Vec::new();

  let mut rows = stmt.query([])?;
  while let Some(row) = rows.next()? {
    let mut row_json: HashMap<String, Value> = HashMap::new();
    for (idx, name) in names.clone().into_iter().enumerate() {
      let json_value: Value = if let Ok(value) = row.get(idx) {
        match value {
          types::Value::Integer(num) => json!(num),
          types::Value::Text(text) => json!(text),
          types::Value::Real(num) => json!(num),
          types::Value::Null => json!(null),
          _ => json!(null),
        }
      } else {
        json!(null)
      };
      row_json.insert(name.to_string(), json_value);
    }
    result.push(row_json);
  }
  Ok(result)
}
