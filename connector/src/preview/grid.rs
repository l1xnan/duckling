use super::cell::{LogicalKind, PreviewCell};

/// One column of preview data.
#[derive(Debug, Clone)]
pub struct PreviewColumn {
  pub name: String,
  /// Native driver type name for UI titles (json, timestamp, BLOB, …).
  pub native_type: String,
  /// Declared logical kind from the dialect (may be refined by values).
  pub kind: LogicalKind,
  pub values: Vec<PreviewCell>,
}

impl PreviewColumn {
  pub fn new(
    name: impl Into<String>,
    native_type: impl Into<String>,
    kind: LogicalKind,
  ) -> Self {
    Self {
      name: name.into(),
      native_type: native_type.into(),
      kind,
      values: Vec::new(),
    }
  }

  pub fn push(&mut self, cell: PreviewCell) {
    self.values.push(cell);
  }

  pub fn len(&self) -> usize {
    self.values.len()
  }

  pub fn is_empty(&self) -> bool {
    self.values.is_empty()
  }
}

/// Full result set as IR before Arrow / rows encoding.
#[derive(Debug, Clone, Default)]
pub struct PreviewGrid {
  pub columns: Vec<PreviewColumn>,
  pub sql: Option<String>,
  /// Optional total for paging (may exceed row_count).
  pub total: Option<usize>,
}

impl PreviewGrid {
  pub fn row_count(&self) -> usize {
    self.columns.first().map(|c| c.len()).unwrap_or(0)
  }

  pub fn is_empty(&self) -> bool {
    self.columns.is_empty() || self.row_count() == 0
  }

  pub fn with_sql(mut self, sql: impl Into<String>) -> Self {
    self.sql = Some(sql.into());
    self
  }

  pub fn with_total(mut self, total: usize) -> Self {
    self.total = Some(total);
    self
  }
}
