use std::sync::Arc;

use arrow::array::{
  ArrayRef, BinaryBuilder, BooleanBuilder, Float64Builder, Int64Builder, StringBuilder,
};
use arrow::datatypes::{DataType, Field, Schema};
use arrow::record_batch::RecordBatch;

use crate::utils::{
  finalize_preview_batch, record_batch_from_arrays, truncate_bytes_for_preview,
  truncate_utf8_for_preview, RawArrowData, Title,
};

use super::cell::{LogicalKind, PreviewCell};
use super::grid::{PreviewColumn, PreviewGrid};

/// Effective Arrow / builder kind after inspecting values (L2 mix → Text).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ResolvedKind {
  Bool,
  Int,
  Float,
  Text,
  Bytes,
}

fn resolve_column_kind(col: &PreviewColumn) -> ResolvedKind {
  let mut saw_bool = false;
  let mut saw_int = false;
  let mut saw_float = false;
  let mut saw_text = false;
  let mut saw_bytes = false;

  for v in &col.values {
    match v {
      PreviewCell::Null => {}
      PreviewCell::Bool(_) => saw_bool = true,
      PreviewCell::Int(_) => saw_int = true,
      PreviewCell::Float(_) => saw_float = true,
      PreviewCell::Text(_) => saw_text = true,
      PreviewCell::Bytes(_) => saw_bytes = true,
    }
  }

  // Mixed types → Text (L2).
  let distinct = [saw_bool, saw_int || saw_float, saw_text, saw_bytes]
    .iter()
    .filter(|&&x| x)
    .count();
  if distinct > 1 {
    return ResolvedKind::Text;
  }
  if saw_text {
    return ResolvedKind::Text;
  }
  if saw_bytes {
    return ResolvedKind::Bytes;
  }
  if saw_float {
    return ResolvedKind::Float;
  }
  if saw_int {
    return ResolvedKind::Int;
  }
  if saw_bool {
    return ResolvedKind::Bool;
  }

  // All null: use declared kind.
  match col.kind {
    LogicalKind::Bool => ResolvedKind::Bool,
    LogicalKind::Int => ResolvedKind::Int,
    LogicalKind::Float => ResolvedKind::Float,
    LogicalKind::Bytes => ResolvedKind::Bytes,
    LogicalKind::Text | LogicalKind::Unknown => ResolvedKind::Text,
  }
}

fn cell_as_text(cell: &PreviewCell) -> Option<String> {
  match cell {
    PreviewCell::Null => None,
    PreviewCell::Bool(b) => Some(b.to_string()),
    PreviewCell::Int(i) => Some(i.to_string()),
    PreviewCell::Float(f) => Some(f.to_string()),
    PreviewCell::Text(s) => Some(truncate_utf8_for_preview(s)),
    PreviewCell::Bytes(b) => {
      let t = truncate_bytes_for_preview(b);
      Some(truncate_utf8_for_preview(&String::from_utf8_lossy(&t)))
    }
  }
}

fn build_column_array(col: &PreviewColumn, kind: ResolvedKind) -> (Field, ArrayRef) {
  let name = col.name.as_str();
  match kind {
    ResolvedKind::Bool => {
      let mut b = BooleanBuilder::with_capacity(col.len());
      for v in &col.values {
        match v {
          PreviewCell::Null => b.append_null(),
          PreviewCell::Bool(x) => b.append_value(*x),
          other => {
            // Should not happen after resolve; coerce via text.
            match cell_as_text(other).as_deref() {
              Some("true") | Some("1") => b.append_value(true),
              Some("false") | Some("0") => b.append_value(false),
              _ => b.append_null(),
            }
          }
        }
      }
      (
        Field::new(name, DataType::Boolean, true),
        Arc::new(b.finish()) as ArrayRef,
      )
    }
    ResolvedKind::Int => {
      let mut b = Int64Builder::with_capacity(col.len());
      for v in &col.values {
        match v {
          PreviewCell::Null => b.append_null(),
          PreviewCell::Int(i) => b.append_value(*i),
          PreviewCell::Float(f) => b.append_value(*f as i64),
          other => match cell_as_text(other).and_then(|s| s.parse().ok()) {
            Some(i) => b.append_value(i),
            None => b.append_null(),
          },
        }
      }
      (
        Field::new(name, DataType::Int64, true),
        Arc::new(b.finish()) as ArrayRef,
      )
    }
    ResolvedKind::Float => {
      let mut b = Float64Builder::with_capacity(col.len());
      for v in &col.values {
        match v {
          PreviewCell::Null => b.append_null(),
          PreviewCell::Float(f) => b.append_value(*f),
          PreviewCell::Int(i) => b.append_value(*i as f64),
          other => match cell_as_text(other).and_then(|s| s.parse().ok()) {
            Some(f) => b.append_value(f),
            None => b.append_null(),
          },
        }
      }
      (
        Field::new(name, DataType::Float64, true),
        Arc::new(b.finish()) as ArrayRef,
      )
    }
    ResolvedKind::Bytes => {
      let mut b = BinaryBuilder::with_capacity(col.len(), col.len() * 16);
      for v in &col.values {
        match v {
          PreviewCell::Null => b.append_null(),
          PreviewCell::Bytes(bytes) => b.append_value(truncate_bytes_for_preview(bytes)),
          PreviewCell::Text(s) => {
            b.append_value(truncate_bytes_for_preview(s.as_bytes()));
          }
          other => match cell_as_text(other) {
            Some(s) => b.append_value(truncate_bytes_for_preview(s.as_bytes())),
            None => b.append_null(),
          },
        }
      }
      (
        Field::new(name, DataType::Binary, true),
        Arc::new(b.finish()) as ArrayRef,
      )
    }
    ResolvedKind::Text => {
      let mut b = StringBuilder::with_capacity(col.len(), col.len() * 16);
      for v in &col.values {
        match cell_as_text(v) {
          Some(s) => b.append_value(s),
          None => b.append_null(),
        }
      }
      (
        Field::new(name, DataType::Utf8, true),
        Arc::new(b.finish()) as ArrayRef,
      )
    }
  }
}

/// Build a [`RecordBatch`] from IR (single place that chooses Arrow types).
pub fn grid_to_arrow(grid: &PreviewGrid) -> anyhow::Result<RecordBatch> {
  if grid.columns.is_empty() {
    let schema = Arc::new(Schema::empty());
    return Ok(RecordBatch::new_empty(schema));
  }

  let row_count = grid.row_count();
  for col in &grid.columns {
    if col.len() != row_count {
      anyhow::bail!(
        "preview column '{}' length {} != row_count {}",
        col.name,
        col.len(),
        row_count
      );
    }
  }

  let mut fields = Vec::with_capacity(grid.columns.len());
  let mut arrays = Vec::with_capacity(grid.columns.len());
  for col in &grid.columns {
    let kind = resolve_column_kind(col);
    let (field, array) = build_column_array(col, kind);
    fields.push(field);
    arrays.push(array);
  }

  let batch = record_batch_from_arrays(fields, arrays)?;
  finalize_preview_batch(batch)
}

/// Convert IR into [`RawArrowData`] for the existing Tauri response path.
pub fn grid_to_raw_arrow_data(grid: PreviewGrid) -> anyhow::Result<RawArrowData> {
  let titles: Vec<Title> = grid
    .columns
    .iter()
    .map(|c| Title {
      name: c.name.clone(),
      r#type: c.native_type.clone(),
    })
    .collect();
  let total = grid.total.unwrap_or_else(|| grid.row_count());
  let sql = grid.sql.clone();
  let batch = grid_to_arrow(&grid)?;
  Ok(RawArrowData {
    total,
    batch,
    titles: Some(titles),
    sql,
  })
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::preview::cell::PreviewCell;
  use arrow::array::{Array, Int64Array, StringArray};

  fn col(name: &str, kind: LogicalKind, values: Vec<PreviewCell>) -> PreviewColumn {
    PreviewColumn {
      name: name.into(),
      native_type: "test".into(),
      kind,
      values,
    }
  }

  #[test]
  fn int_column_becomes_int64() {
    let grid = PreviewGrid {
      columns: vec![col(
        "id",
        LogicalKind::Int,
        vec![PreviewCell::Int(1), PreviewCell::Null, PreviewCell::Int(3)],
      )],
      sql: None,
      total: None,
    };
    let batch = grid_to_arrow(&grid).unwrap();
    assert_eq!(batch.num_rows(), 3);
    assert_eq!(batch.schema().field(0).data_type(), &DataType::Int64);
    let arr = batch
      .column(0)
      .as_any()
      .downcast_ref::<Int64Array>()
      .unwrap();
    assert_eq!(arr.value(0), 1);
    assert!(arr.is_null(1));
  }

  #[test]
  fn mixed_int_and_text_becomes_utf8() {
    let grid = PreviewGrid {
      columns: vec![col(
        "x",
        LogicalKind::Int,
        vec![PreviewCell::Int(1), PreviewCell::Text("a".into())],
      )],
      sql: None,
      total: None,
    };
    let batch = grid_to_arrow(&grid).unwrap();
    assert_eq!(batch.schema().field(0).data_type(), &DataType::Utf8);
    let arr = batch
      .column(0)
      .as_any()
      .downcast_ref::<StringArray>()
      .unwrap();
    assert_eq!(arr.value(0), "1");
    assert_eq!(arr.value(1), "a");
  }

  #[test]
  fn text_truncation_applied() {
    let big = "z".repeat(crate::utils::MAX_PREVIEW_CELL_BYTES + 20);
    let grid = PreviewGrid {
      columns: vec![col(
        "t",
        LogicalKind::Text,
        vec![PreviewCell::Text(big)],
      )],
      sql: Some("select 1".into()),
      total: Some(1),
    };
    let raw = grid_to_raw_arrow_data(grid).unwrap();
    assert_eq!(raw.total, 1);
    assert_eq!(raw.sql.as_deref(), Some("select 1"));
    let arr = raw
      .batch
      .column(0)
      .as_any()
      .downcast_ref::<StringArray>()
      .unwrap();
    assert!(arr.value(0).len() <= crate::utils::MAX_PREVIEW_CELL_BYTES + 3);
  }
}
