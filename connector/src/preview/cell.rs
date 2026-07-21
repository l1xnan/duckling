/// Logical column category (not Arrow). Dialects map wire types here.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogicalKind {
  Bool,
  Int,
  Float,
  Text,
  Bytes,
  Unknown,
}

/// Normalized cell for grid preview (DB-agnostic).
#[derive(Debug, Clone, PartialEq)]
pub enum PreviewCell {
  Null,
  Bool(bool),
  Int(i64),
  Float(f64),
  Text(String),
  Bytes(Vec<u8>),
}

impl PreviewCell {
  pub fn is_null(&self) -> bool {
    matches!(self, PreviewCell::Null)
  }
}

/// Result of decoding one cell. Never panics at the dialect boundary.
#[derive(Debug, Clone)]
pub enum DecodeResult {
  Ok(PreviewCell),
  /// L1: unreadable → shared layer turns into Null (or placeholder later).
  Unreadable,
}

impl DecodeResult {
  pub fn into_cell(self) -> PreviewCell {
    match self {
      DecodeResult::Ok(c) => c,
      DecodeResult::Unreadable => PreviewCell::Null,
    }
  }
}
