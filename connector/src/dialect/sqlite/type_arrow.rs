use arrow::array::{
  ArrayBuilder, ArrayRef, BooleanBuilder, Float64Builder, Int64Builder, LargeBinaryBuilder,
  StringBuilder,
};
use arrow::datatypes::{DataType, Field};
use itertools::izip;
use rusqlite::{types::Value, Statement};

use crate::utils::{
  finalize_preview_batch, record_batch_from_arrays, truncate_bytes_for_preview,
  truncate_utf8_for_preview,
};

pub fn db_to_arrow_type(decl_type: Option<&str>) -> DataType {
  // https://sqlite.org/datatype3.html#determination_of_column_affinity
  if let Some(decl_type) = decl_type {
    match decl_type {
      ty if ty.contains("INT") => DataType::Int64,
      ty if ty.contains("REAL") || ty.contains("DOUB") || ty.contains("FLOA") => DataType::Float64,
      ty if ty.contains("CHAR") || ty.contains("CLOB") || ty.contains("TEXT") => DataType::Utf8,
      ty if ty.contains("NUMERIC") => DataType::Utf8,
      ty if ty.contains("BLOB") => DataType::LargeBinary,
      "DATE" | "DATETIME" | "TIME" => DataType::Utf8,
      "BOOLEAN" => DataType::Boolean,
      _ => DataType::Utf8,
    }
  } else {
    DataType::Utf8
  }
}

fn make_builder(data_type: &DataType) -> Box<dyn ArrayBuilder> {
  match data_type {
    DataType::Int64 => Box::new(Int64Builder::new()),
    DataType::LargeBinary => Box::new(LargeBinaryBuilder::new()),
    DataType::Utf8 => Box::new(StringBuilder::new()),
    DataType::Float64 => Box::new(Float64Builder::new()),
    DataType::Boolean => Box::new(BooleanBuilder::new()),
    // Unknown → Utf8 builder so every cell can still be appended.
    _ => Box::new(StringBuilder::new()),
  }
}

/// Every row/column must append exactly once (value or null).
pub fn db_result_to_arrow(stmt: &mut Statement) -> anyhow::Result<arrow::record_batch::RecordBatch> {
  let data_types: Vec<DataType> = stmt
    .columns()
    .iter()
    .map(|col| db_to_arrow_type(col.decl_type()))
    .collect();

  let fields: Vec<Field> = izip!(stmt.column_names(), data_types.clone())
    .map(|(name, data_type)| Field::new(name, data_type.clone(), true))
    .collect();

  let mut builders: Vec<Box<dyn ArrayBuilder>> = data_types.iter().map(make_builder).collect();

  let mut rows = stmt.query([])?;
  while let Some(row) = rows.next()? {
    for (idx, data_type) in data_types.iter().enumerate() {
      let val = row.get::<_, Value>(idx).unwrap_or(Value::Null);
      append_cell(builders[idx].as_mut(), data_type, &val);
    }
  }

  let mut columns: Vec<ArrayRef> = Vec::with_capacity(builders.len());
  for mut builder in builders {
    columns.push(builder.finish());
  }

  let batch = record_batch_from_arrays(fields, columns)?;
  finalize_preview_batch(batch)
}

fn append_cell(builder: &mut dyn ArrayBuilder, data_type: &DataType, val: &Value) {
  match data_type {
    DataType::Int64 => {
      let value = match val {
        Value::Integer(i) => Some(*i),
        Value::Real(f) => Some(*f as i64),
        Value::Text(s) => s.parse::<i64>().ok(),
        _ => None,
      };
      builder
        .as_any_mut()
        .downcast_mut::<Int64Builder>()
        .expect("Int64Builder")
        .append_option(value);
    }
    DataType::Float64 => {
      let value = match val {
        Value::Real(f) => Some(*f),
        Value::Integer(i) => Some(*i as f64),
        Value::Text(s) => s.parse::<f64>().ok(),
        _ => None,
      };
      builder
        .as_any_mut()
        .downcast_mut::<Float64Builder>()
        .expect("Float64Builder")
        .append_option(value);
    }
    DataType::Boolean => {
      let value = match val {
        Value::Integer(i) => Some(*i != 0),
        Value::Text(s) => match s.to_ascii_lowercase().as_str() {
          "1" | "true" | "t" | "yes" => Some(true),
          "0" | "false" | "f" | "no" => Some(false),
          _ => None,
        },
        _ => None,
      };
      builder
        .as_any_mut()
        .downcast_mut::<BooleanBuilder>()
        .expect("BooleanBuilder")
        .append_option(value);
    }
    DataType::LargeBinary => {
      let value = match val {
        Value::Blob(b) => Some(truncate_bytes_for_preview(b)),
        Value::Text(s) => Some(truncate_bytes_for_preview(s.as_bytes())),
        Value::Null => None,
        other => convert_to_string(other).map(|s| truncate_bytes_for_preview(s.as_bytes())),
      };
      builder
        .as_any_mut()
        .downcast_mut::<LargeBinaryBuilder>()
        .expect("LargeBinaryBuilder")
        .append_option(value);
    }
    // Utf8 and any unexpected DataType (builder is StringBuilder).
    _ => {
      let value = convert_to_string(val).map(|s| truncate_utf8_for_preview(&s));
      if let Some(sb) = builder.as_any_mut().downcast_mut::<StringBuilder>() {
        sb.append_option(value);
      } else {
        // Should not happen if make_builder stays in sync; still avoid skip-append.
        log::warn!("sqlite preview: unexpected builder for Utf8 column");
      }
    }
  }
}

pub fn convert_to_string(value: &Value) -> Option<String> {
  match value {
    Value::Integer(i) => Some(i.to_string()),
    Value::Real(f) => Some(f.to_string()),
    Value::Text(s) => Some(s.clone()),
    Value::Blob(b) => Some(String::from_utf8_lossy(b).into_owned()),
    Value::Null => None,
  }
}

#[allow(dead_code)]
pub fn convert_to_i64(value: &Value) -> Option<i64> {
  match value {
    Value::Integer(i) => Some(*i),
    Value::Real(f) => Some(*f as i64),
    Value::Text(s) => s.parse::<i64>().ok(),
    _ => None,
  }
}

#[allow(dead_code)]
pub fn convert_to_f64(value: &Value) -> Option<f64> {
  match value {
    Value::Integer(i) => Some(*i as f64),
    Value::Real(f) => Some(*f),
    Value::Text(s) => s.parse::<f64>().ok(),
    _ => None,
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use arrow::array::Array;

  #[test]
  fn affinity_int_and_blob() {
    assert_eq!(db_to_arrow_type(Some("INTEGER")), DataType::Int64);
    assert_eq!(db_to_arrow_type(Some("BLOB")), DataType::LargeBinary);
    assert_eq!(db_to_arrow_type(None), DataType::Utf8);
  }

  #[test]
  fn append_cell_always_extends_int_builder() {
    let mut builder = Int64Builder::new();
    append_cell(&mut builder, &DataType::Int64, &Value::Integer(1));
    append_cell(&mut builder, &DataType::Int64, &Value::Text("x".into())); // → null
    append_cell(&mut builder, &DataType::Int64, &Value::Null);
    let arr = builder.finish();
    assert_eq!(arr.len(), 3);
    assert_eq!(arr.value(0), 1);
    assert!(arr.is_null(1));
    assert!(arr.is_null(2));
  }
}
