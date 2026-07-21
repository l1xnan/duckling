//! SQLite → [`PreviewGrid`] decoder (Phase 3 IR).

use rusqlite::{types::Value, Statement};

use crate::preview::{LogicalKind, PreviewCell, PreviewColumn, PreviewGrid};
use crate::utils::{truncate_bytes_for_preview, truncate_utf8_for_preview};

pub fn decl_to_kind(decl_type: Option<&str>) -> LogicalKind {
  if let Some(decl_type) = decl_type {
    match decl_type {
      ty if ty.contains("INT") => LogicalKind::Int,
      ty if ty.contains("REAL") || ty.contains("DOUB") || ty.contains("FLOA") => LogicalKind::Float,
      ty if ty.contains("CHAR") || ty.contains("CLOB") || ty.contains("TEXT") => LogicalKind::Text,
      ty if ty.contains("NUMERIC") => LogicalKind::Text,
      ty if ty.contains("BLOB") => LogicalKind::Bytes,
      "DATE" | "DATETIME" | "TIME" => LogicalKind::Text,
      "BOOLEAN" => LogicalKind::Bool,
      _ => LogicalKind::Text,
    }
  } else {
    LogicalKind::Unknown
  }
}

fn value_to_cell(val: &Value, kind: LogicalKind) -> PreviewCell {
  match val {
    Value::Null => PreviewCell::Null,
    Value::Integer(i) => match kind {
      LogicalKind::Bool => PreviewCell::Bool(*i != 0),
      LogicalKind::Float => PreviewCell::Float(*i as f64),
      LogicalKind::Text => PreviewCell::Text(i.to_string()),
      LogicalKind::Bytes => PreviewCell::Bytes(i.to_string().into_bytes()),
      _ => PreviewCell::Int(*i),
    },
    Value::Real(f) => match kind {
      LogicalKind::Int => PreviewCell::Int(*f as i64),
      LogicalKind::Text => PreviewCell::Text(f.to_string()),
      LogicalKind::Bool => PreviewCell::Bool(*f != 0.0),
      _ => PreviewCell::Float(*f),
    },
    Value::Text(s) => match kind {
      LogicalKind::Int => s
        .parse::<i64>()
        .map(PreviewCell::Int)
        .unwrap_or_else(|_| PreviewCell::Text(truncate_utf8_for_preview(s))),
      LogicalKind::Float => s
        .parse::<f64>()
        .map(PreviewCell::Float)
        .unwrap_or_else(|_| PreviewCell::Text(truncate_utf8_for_preview(s))),
      LogicalKind::Bool => match s.to_ascii_lowercase().as_str() {
        "1" | "true" | "t" | "yes" => PreviewCell::Bool(true),
        "0" | "false" | "f" | "no" => PreviewCell::Bool(false),
        _ => PreviewCell::Text(truncate_utf8_for_preview(s)),
      },
      LogicalKind::Bytes => PreviewCell::Bytes(truncate_bytes_for_preview(s.as_bytes())),
      _ => PreviewCell::Text(truncate_utf8_for_preview(s)),
    },
    Value::Blob(b) => match kind {
      LogicalKind::Text | LogicalKind::Unknown => {
        let t = truncate_bytes_for_preview(b);
        PreviewCell::Text(truncate_utf8_for_preview(&String::from_utf8_lossy(&t)))
      }
      _ => PreviewCell::Bytes(truncate_bytes_for_preview(b)),
    },
  }
}

/// Decode a prepared statement result into [`PreviewGrid`].
pub fn statement_to_grid(stmt: &mut Statement, sql: &str) -> anyhow::Result<PreviewGrid> {
  let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
  let kinds: Vec<LogicalKind> = stmt
    .columns()
    .iter()
    .map(|c| decl_to_kind(c.decl_type()))
    .collect();
  let native_types: Vec<String> = stmt
    .columns()
    .iter()
    .map(|c| c.decl_type().unwrap_or("").to_string())
    .collect();

  let mut columns: Vec<PreviewColumn> = names
    .into_iter()
    .zip(kinds.iter().copied())
    .zip(native_types)
    .map(|((name, kind), native)| PreviewColumn::new(name, native, kind))
    .collect();

  let mut rows = stmt.query([])?;
  while let Some(row) = rows.next()? {
    for (idx, col) in columns.iter_mut().enumerate() {
      let val = row.get::<_, Value>(idx).unwrap_or(Value::Null);
      col.push(value_to_cell(&val, col.kind));
    }
  }

  Ok(PreviewGrid {
    columns,
    sql: Some(sql.to_string()),
    total: None,
  })
}
