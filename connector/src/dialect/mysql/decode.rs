//! MySQL → [`PreviewGrid`] decoder (Phase 3 IR).

use mysql::consts::ColumnType;
use mysql::consts::ColumnType::*;
use mysql::{Column, Value};

use crate::preview::{LogicalKind, PreviewCell, PreviewColumn, PreviewGrid};
use crate::utils::{truncate_bytes_for_preview, truncate_utf8_for_preview};

pub fn column_kind(col_type: ColumnType) -> LogicalKind {
  match col_type {
    MYSQL_TYPE_TINY | MYSQL_TYPE_INT24 | MYSQL_TYPE_SHORT | MYSQL_TYPE_LONG
    | MYSQL_TYPE_LONGLONG => LogicalKind::Int,
    MYSQL_TYPE_DECIMAL
    | MYSQL_TYPE_NEWDECIMAL
    | MYSQL_TYPE_FLOAT
    | MYSQL_TYPE_YEAR
    | MYSQL_TYPE_DOUBLE => LogicalKind::Float,
    _ => LogicalKind::Text,
  }
}

pub fn native_type_name(col_type: ColumnType) -> String {
  let type_ = format!("{col_type:?}");
  type_
    .strip_prefix("MYSQL_TYPE_")
    .unwrap_or(type_.as_str())
    .to_string()
}

fn value_to_cell(val: &Value, kind: LogicalKind) -> PreviewCell {
  match val {
    Value::NULL => PreviewCell::Null,
    Value::Int(i) => match kind {
      LogicalKind::Float => PreviewCell::Float(*i as f64),
      LogicalKind::Text => PreviewCell::Text(i.to_string()),
      LogicalKind::Bool => PreviewCell::Bool(*i != 0),
      _ => PreviewCell::Int(*i),
    },
    Value::UInt(u) => match kind {
      LogicalKind::Float => PreviewCell::Float(*u as f64),
      LogicalKind::Text => PreviewCell::Text(u.to_string()),
      LogicalKind::Bool => PreviewCell::Bool(*u != 0),
      _ => i64::try_from(*u)
        .map(PreviewCell::Int)
        .unwrap_or_else(|_| PreviewCell::Text(u.to_string())),
    },
    Value::Float(f) => match kind {
      LogicalKind::Int => PreviewCell::Int(*f as i64),
      LogicalKind::Text => PreviewCell::Text(f.to_string()),
      _ => PreviewCell::Float(f64::from(*f)),
    },
    Value::Double(f) => match kind {
      LogicalKind::Int => PreviewCell::Int(*f as i64),
      LogicalKind::Text => PreviewCell::Text(f.to_string()),
      _ => PreviewCell::Float(*f),
    },
    Value::Bytes(bytes) => {
      let t = truncate_bytes_for_preview(bytes);
      match kind {
        LogicalKind::Int => std::str::from_utf8(&t)
          .ok()
          .and_then(|s| s.parse().ok())
          .map(PreviewCell::Int)
          .unwrap_or_else(|| {
            PreviewCell::Text(truncate_utf8_for_preview(&String::from_utf8_lossy(&t)))
          }),
        LogicalKind::Float => std::str::from_utf8(&t)
          .ok()
          .and_then(|s| s.parse().ok())
          .map(PreviewCell::Float)
          .unwrap_or_else(|| {
            PreviewCell::Text(truncate_utf8_for_preview(&String::from_utf8_lossy(&t)))
          }),
        LogicalKind::Bytes => PreviewCell::Bytes(t),
        _ => PreviewCell::Text(truncate_utf8_for_preview(&String::from_utf8_lossy(&t))),
      }
    }
    Value::Date(y, m, d, h, mi, s, us) => {
      PreviewCell::Text(format!("{y:04}-{m:02}-{d:02} {h:02}:{mi:02}:{s:02}.{us:06}"))
    }
    Value::Time(neg, d, h, mi, s, us) => {
      let sign = if *neg { "-" } else { "" };
      PreviewCell::Text(format!("{sign}{d} {h:02}:{mi:02}:{s:02}.{us:06}"))
    }
  }
}

/// Column meta owned independently of the live result set (avoids borrow issues).
#[derive(Debug, Clone)]
pub struct ColumnMeta {
  pub name: String,
  pub kind: LogicalKind,
  pub native_type: String,
}

impl ColumnMeta {
  pub fn from_column(c: &Column) -> Self {
    let ct = c.column_type();
    Self {
      name: c.name_str().to_string(),
      kind: column_kind(ct),
      native_type: native_type_name(ct),
    }
  }
}

/// Build a [`PreviewGrid`] from owned column meta + column-oriented values.
pub fn columns_to_grid(
  metas: &[ColumnMeta],
  tables: Vec<Vec<Value>>,
  sql: &str,
) -> PreviewGrid {
  let mut cols: Vec<PreviewColumn> = metas
    .iter()
    .map(|m| PreviewColumn::new(m.name.clone(), m.native_type.clone(), m.kind))
    .collect();

  for (col, values) in cols.iter_mut().zip(tables) {
    let kind = col.kind;
    for v in values {
      col.push(value_to_cell(&v, kind));
    }
  }

  PreviewGrid {
    columns: cols,
    sql: Some(sql.to_string()),
    total: None,
  }
}
