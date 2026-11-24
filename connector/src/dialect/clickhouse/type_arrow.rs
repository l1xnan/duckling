use std::sync::Arc;

use arrow::array::{
  ArrayRef, BooleanBuilder, Float64Builder, Int64Builder, LargeStringBuilder, UInt64Builder,
};
use arrow::datatypes::{DataType, Field};
use arrow::record_batch::RecordBatch;

use crate::utils::{finalize_preview_batch, record_batch_from_arrays, truncate_utf8_for_preview};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ClickHouseKind {
  Float,
  Int64,
  UInt64,
  Bool,
  Text,
}

/// Unwrap `Nullable` / `LowCardinality` and return the base type name (`Float64`, `Decimal`, …).
pub fn clickhouse_base_type(ty: &str) -> &str {
  let mut s = ty.trim();
  loop {
    if let Some(inner) = strip_outer_fn(s, "Nullable") {
      s = inner;
      continue;
    }
    if let Some(inner) = strip_outer_fn(s, "LowCardinality") {
      s = inner;
      continue;
    }
    break;
  }
  s.split('(').next().unwrap_or(s).trim()
}

fn strip_outer_fn<'a>(s: &'a str, name: &str) -> Option<&'a str> {
  let rest = s.strip_prefix(name)?.trim_start();
  let rest = rest.strip_prefix('(')?;
  let rest = rest.strip_suffix(')')?.trim();
  Some(rest)
}

fn clickhouse_kind(ty: &str) -> ClickHouseKind {
  match clickhouse_base_type(ty) {
    "Float32" | "Float64" | "BFloat16" => ClickHouseKind::Float,
    "Int8" | "Int16" | "Int32" | "Int64" | "UInt8" | "UInt16" | "UInt32" => ClickHouseKind::Int64,
    "UInt64" => ClickHouseKind::UInt64,
    "Bool" | "Boolean" => ClickHouseKind::Bool,
    _ => ClickHouseKind::Text,
  }
}

fn json_cell_string(row: &serde_json::Value, name: &str) -> Option<String> {
  match row.get(name)? {
    serde_json::Value::Null => None,
    serde_json::Value::String(s) => Some(s.clone()),
    serde_json::Value::Number(n) => Some(n.to_string()),
    serde_json::Value::Bool(b) => Some(if *b { "true" } else { "false" }.to_string()),
    other => Some(other.to_string()),
  }
}

fn string_column(name: &str, rows: &[serde_json::Value]) -> ArrayRef {
  let mut builder = LargeStringBuilder::with_capacity(rows.len(), rows.len() * 8);
  for row in rows {
    match json_cell_string(row, name) {
      Some(s) => builder.append_value(truncate_utf8_for_preview(&s)),
      None => builder.append_null(),
    }
  }
  Arc::new(builder.finish())
}

fn build_column(name: &str, ty: &str, rows: &[serde_json::Value]) -> (DataType, ArrayRef) {
  match clickhouse_kind(ty) {
    ClickHouseKind::Text => (DataType::LargeUtf8, string_column(name, rows)),
    ClickHouseKind::Float => build_float(name, rows),
    ClickHouseKind::Int64 => build_i64(name, rows),
    ClickHouseKind::UInt64 => build_u64(name, rows),
    ClickHouseKind::Bool => build_bool(name, rows),
  }
}

fn build_float(name: &str, rows: &[serde_json::Value]) -> (DataType, ArrayRef) {
  let mut builder = Float64Builder::with_capacity(rows.len());
  for row in rows {
    match json_cell_string(row, name) {
      None => builder.append_null(),
      Some(s) => match parse_optional_f64(&s) {
        Ok(Some(v)) => builder.append_value(v),
        Ok(None) => builder.append_null(),
        Err(()) => return (DataType::LargeUtf8, string_column(name, rows)),
      },
    }
  }
  (DataType::Float64, Arc::new(builder.finish()))
}

fn build_i64(name: &str, rows: &[serde_json::Value]) -> (DataType, ArrayRef) {
  let mut builder = Int64Builder::with_capacity(rows.len());
  for row in rows {
    match json_cell_string(row, name) {
      None => builder.append_null(),
      Some(s) => match parse_optional(&s) {
        Ok(Some(v)) => builder.append_value(v),
        Ok(None) => builder.append_null(),
        Err(()) => return (DataType::LargeUtf8, string_column(name, rows)),
      },
    }
  }
  (DataType::Int64, Arc::new(builder.finish()))
}

fn build_u64(name: &str, rows: &[serde_json::Value]) -> (DataType, ArrayRef) {
  let mut builder = UInt64Builder::with_capacity(rows.len());
  for row in rows {
    match json_cell_string(row, name) {
      None => builder.append_null(),
      Some(s) => match parse_optional(&s) {
        Ok(Some(v)) => builder.append_value(v),
        Ok(None) => builder.append_null(),
        Err(()) => return (DataType::LargeUtf8, string_column(name, rows)),
      },
    }
  }
  (DataType::UInt64, Arc::new(builder.finish()))
}

fn build_bool(name: &str, rows: &[serde_json::Value]) -> (DataType, ArrayRef) {
  let mut builder = BooleanBuilder::with_capacity(rows.len());
  for row in rows {
    match json_cell_string(row, name) {
      None => builder.append_null(),
      Some(s) => match parse_optional_bool(&s) {
        Ok(Some(v)) => builder.append_value(v),
        Ok(None) => builder.append_null(),
        Err(()) => return (DataType::LargeUtf8, string_column(name, rows)),
      },
    }
  }
  (DataType::Boolean, Arc::new(builder.finish()))
}

fn parse_optional<T: std::str::FromStr>(s: &str) -> Result<Option<T>, ()> {
  let t = s.trim();
  if t.is_empty() {
    return Ok(None);
  }
  t.parse().map(Some).map_err(|_| ())
}

fn parse_optional_f64(s: &str) -> Result<Option<f64>, ()> {
  parse_optional(s)
}

fn parse_optional_bool(s: &str) -> Result<Option<bool>, ()> {
  match s.trim().to_ascii_lowercase().as_str() {
    "" => Ok(None),
    "true" | "1" => Ok(Some(true)),
    "false" | "0" => Ok(Some(false)),
    _ => Err(()),
  }
}

/// JSONStrings returns every cell as a string. Map numeric ClickHouse types onto Arrow
/// numbers so the grid can align, sort, and apply float precision.
pub fn clickhouse_json_to_batch(
  columns: &[(String, String)],
  rows: &[serde_json::Value],
) -> anyhow::Result<RecordBatch> {
  let mut fields = Vec::with_capacity(columns.len());
  let mut arrays = Vec::with_capacity(columns.len());
  for (name, ty) in columns {
    let (data_type, array) = build_column(name, ty, rows);
    fields.push(Field::new(name, data_type, true));
    arrays.push(array);
  }
  let batch = record_batch_from_arrays(fields, arrays)?;
  finalize_preview_batch(batch)
}

#[cfg(test)]
mod tests {
  use super::*;
  use arrow::array::{
    Array, BooleanArray, Float64Array, Int64Array, LargeStringArray, UInt64Array,
  };
  use serde_json::json;

  fn col(name: &str, ty: &str) -> (String, String) {
    (name.to_string(), ty.to_string())
  }

  #[test]
  fn unwraps_nullable_and_low_cardinality() {
    assert_eq!(clickhouse_base_type("Float64"), "Float64");
    assert_eq!(clickhouse_base_type("Nullable(Float64)"), "Float64");
    assert_eq!(
      clickhouse_base_type("LowCardinality(Nullable(Float64))"),
      "Float64"
    );
    assert_eq!(clickhouse_base_type("Decimal(18, 4)"), "Decimal");
    assert_eq!(clickhouse_base_type("Nullable(Decimal64(4))"), "Decimal64");
  }

  #[test]
  fn float64_strings_become_float_values() {
    let columns = vec![col("amount", "Float64"), col("label", "String")];
    let rows = vec![
      json!({"amount": "1.23456789", "label": "a"}),
      json!({"amount": null, "label": "b"}),
      json!({"amount": "inf", "label": "c"}),
    ];
    let batch = clickhouse_json_to_batch(&columns, &rows).unwrap();
    assert_eq!(batch.schema().field(0).data_type(), &DataType::Float64);
    assert_eq!(batch.schema().field(1).data_type(), &DataType::LargeUtf8);

    let floats = batch
      .column(0)
      .as_any()
      .downcast_ref::<Float64Array>()
      .unwrap();
    assert_eq!(floats.value(0), 1.23456789);
    assert!(floats.is_null(1));
    assert!(floats.value(2).is_infinite());

    let labels = batch
      .column(1)
      .as_any()
      .downcast_ref::<LargeStringArray>()
      .unwrap();
    assert_eq!(labels.value(0), "a");
  }

  #[test]
  fn wrapped_float_int_uint_and_bool() {
    let columns = vec![
      col("f", "LowCardinality(Nullable(Float32))"),
      col("i", "Nullable(Int64)"),
      col("u", "UInt64"),
      col("b", "Bool"),
    ];
    let rows = vec![json!({
      "f": "2.5",
      "i": "42",
      "u": "18446744073709551615",
      "b": "true",
    })];
    let batch = clickhouse_json_to_batch(&columns, &rows).unwrap();
    assert_eq!(batch.schema().field(0).data_type(), &DataType::Float64);
    assert_eq!(batch.schema().field(1).data_type(), &DataType::Int64);
    assert_eq!(batch.schema().field(2).data_type(), &DataType::UInt64);
    assert_eq!(batch.schema().field(3).data_type(), &DataType::Boolean);

    assert_eq!(
      batch
        .column(0)
        .as_any()
        .downcast_ref::<Float64Array>()
        .unwrap()
        .value(0),
      2.5
    );
    assert_eq!(
      batch
        .column(1)
        .as_any()
        .downcast_ref::<Int64Array>()
        .unwrap()
        .value(0),
      42
    );
    assert_eq!(
      batch
        .column(2)
        .as_any()
        .downcast_ref::<UInt64Array>()
        .unwrap()
        .value(0),
      u64::MAX
    );
    assert!(
      batch
        .column(3)
        .as_any()
        .downcast_ref::<BooleanArray>()
        .unwrap()
        .value(0)
    );
  }

  #[test]
  fn decimal_and_unparseable_float_stay_text() {
    let columns = vec![col("d", "Decimal(18, 4)"), col("bad", "Float64")];
    let rows = vec![json!({"d": "1.2300", "bad": "not-a-number"})];
    let batch = clickhouse_json_to_batch(&columns, &rows).unwrap();
    assert_eq!(batch.schema().field(0).data_type(), &DataType::LargeUtf8);
    assert_eq!(batch.schema().field(1).data_type(), &DataType::LargeUtf8);
    let decimals = batch
      .column(0)
      .as_any()
      .downcast_ref::<LargeStringArray>()
      .unwrap();
    assert_eq!(decimals.value(0), "1.2300");
    let bad = batch
      .column(1)
      .as_any()
      .downcast_ref::<LargeStringArray>()
      .unwrap();
    assert_eq!(bad.value(0), "not-a-number");
  }

  #[test]
  fn empty_rows_keep_numeric_schema() {
    let columns = vec![col("amount", "Nullable(Float64)")];
    let batch = clickhouse_json_to_batch(&columns, &[]).unwrap();
    assert_eq!(batch.num_rows(), 0);
    assert_eq!(batch.schema().field(0).data_type(), &DataType::Float64);
  }
}
