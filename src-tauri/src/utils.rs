use crate::dialect::TreeNode;
use std::collections::HashMap;
use std::fmt::Debug;
use std::path::Path;
pub struct Table {
  pub table_name: String,
  pub table_type: String,
  pub table_schema: String,
}

pub fn get_file_name<P: AsRef<Path>>(path: P) -> String {
  path
    .as_ref()
    .file_name()
    .unwrap()
    .to_string_lossy()
    .to_string()
}
