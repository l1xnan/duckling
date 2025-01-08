use itertools::izip;
use rusqlite::{types, Statement};
use serde_json::{json, Value};
use std::collections::HashMap;

fn db_result_to_json(stmt: &mut Statement) -> anyhow::Result<Value> {
  let k = stmt.column_count();
  let mut result: Vec<Vec<Value>> = Vec::new();
  {
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
      // let mut row_json: HashMap<&str, Value> = HashMap::new();
      let mut json_row: Vec<Value> = vec![];
      for index in 0..k {
        let json_value: Value = if let Ok(value) = row.get(index) {
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
        json_row.push(json_value);
      }
      result.push(json_row);
    }
  }

  let names = stmt.column_names();
  let res: Vec<HashMap<&str, Value>> = result
    .into_iter()
    .map(|values| izip!(names.clone(), values).collect())
    .collect();
  Ok(json!(res))
}
