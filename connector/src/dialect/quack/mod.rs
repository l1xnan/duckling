use crate::dialect::Connection;
use crate::dialect::duckdb::duckdb_sync::DuckDbSyncConnection;
use crate::utils::{Metadata, RawArrowData, Table, TreeNode, build_tree};
use async_trait::async_trait;
use regex::Regex;
use std::collections::BTreeMap;
use std::path::Path;
use std::sync::OnceLock;

#[derive(Debug, Default, Clone)]
pub struct QuackConnection {
  pub uri: String,
  pub token: Option<String>,
  pub disable_ssl: bool,
  pub glob: Option<String>,
}

fn fn_call_re() -> &'static Regex {
  static RE: OnceLock<Regex> = OnceLock::new();
  RE.get_or_init(|| Regex::new(r"^[a-zA-Z_][a-zA-Z0-9_]*\([^)]*\)$").unwrap())
}

#[async_trait]
impl Connection for QuackConnection {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let this = self.clone();
    crate::dialect::run_blocking(move || {
      let conn = this.connect()?;
      let tables = this.get_tables(&conn)?;
      let files = this.get_files(&conn).unwrap_or_default();
      let mut children = build_tree(tables);
      if !files.is_empty() {
        let count = count_file_leaves(&files);
        let mut node = TreeNode::new_files(&this.uri, Some(files));
        node.name = format!("files ({count})");
        children.push(node);
      }
      Ok(TreeNode {
        name: this.uri.clone(),
        path: this.uri.clone(),
        node_type: "root".to_string(),
        schema: None,
        children: Some(children),
        size: None,
        comment: None,
      })
    })
    .await
  }

  async fn list_databases(&self) -> anyhow::Result<Vec<String>> {
    let this = self.clone();
    crate::dialect::run_blocking(move || {
      let conn = this.connect()?;
      this.databases(&conn)
    })
    .await
  }

  async fn query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    let this = self.clone();
    let sql = sql.to_string();
    crate::dialect::run_blocking(move || {
      let conn = this.connect()?;
      let wrapped = this.wrap_sql(&sql);
      let (titles, batch) = conn.query(&wrapped)?;
      let total = batch.num_rows();
      Ok(RawArrowData {
        total,
        batch,
        titles: Some(titles),
        sql: Some(sql),
      })
    })
    .await
  }

  async fn query_count(&self, sql: &str) -> anyhow::Result<usize> {
    let this = self.clone();
    let sql = sql.to_string();
    crate::dialect::run_blocking(move || {
      let conn = this.connect()?;
      let wrapped = this.wrap_sql(&sql);
      let total = conn
        .inner
        .query_row(&wrapped, [], |row| row.get::<_, usize>(0))?;
      Ok(total)
    })
    .await
  }

  fn dialect(&self) -> &'static str {
    "quack"
  }

  async fn show_schema(&self, schema: &str) -> anyhow::Result<RawArrowData> {
    let sql = format!(
      "SELECT * FROM information_schema.tables WHERE table_schema='{schema}' ORDER BY table_type, table_name"
    );
    self.query(&sql, 0, 0).await
  }

  async fn show_column(&self, schema: Option<&str>, table: &str) -> anyhow::Result<RawArrowData> {
    // Frontend already wraps file paths as read_xxx('path') — just DESCRIBE it.
    if is_read_function(table) {
      let sql = format!("DESCRIBE SELECT * FROM {table}");
      log::info!("show columns (file function): {}", &sql);
      return self.query(&sql, 0, 0).await;
    }

    let (db, tbl) = if schema.is_none() && table.contains('.') {
      let parts: Vec<&str> = table.splitn(2, '.').collect();
      (parts[0], parts[1])
    } else {
      (schema.unwrap_or(""), table)
    };
    let sql = format!(
      "SELECT * FROM information_schema.columns WHERE table_schema='{db}' AND table_name='{tbl}'"
    );
    log::info!("show columns: {}", &sql);
    self.query(&sql, 0, 0).await
  }

  async fn all_columns(&self) -> anyhow::Result<Vec<Metadata>> {
    let this = self.clone();
    crate::dialect::run_blocking(move || {
      let conn = this.connect()?;
      this.fetch_all_columns(&conn)
    })
    .await
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let sql = self._table_count_sql(table, r#where);
    self.query_count(&sql).await
  }

  /// Skip quoting for function calls like `read_parquet('path.parquet', ...)`.
  fn quote_table_ref(&self, table: &str) -> String {
    if is_read_function(table) {
      return table.to_string();
    }
    // Default: split by '.' and quote each segment.
    table
      .split('.')
      .map(|item| self.quote(item))
      .collect::<Vec<_>>()
      .join(".")
  }

  fn normalize(&self, name: &str) -> String {
    if name.contains(' ') {
      format!("\"{name}\"")
    } else {
      name.to_string()
    }
  }

  async fn export(
    &self,
    sql: &str,
    file: &str,
    format: &str,
    options: &crate::utils::ExportOptions,
    cancel: Option<&crate::cancel::CancelToken>,
  ) -> anyhow::Result<()> {
    if let Some(t) = cancel {
      t.check()?;
    }
    let this = self.clone();
    let sql = sql.to_string();
    let file = file.to_string();
    let format = format.to_string();
    let options = options.clone();
    crate::dialect::run_blocking(move || {
      let conn = this.connect()?;
      let wrapped = this.wrap_sql(&sql);
      conn.export(&wrapped, &file, &format, &options)
    })
    .await
  }

  fn start_quote(&self) -> &'static str {
    "\""
  }

  fn end_quote(&self) -> &'static str {
    "\""
  }

  fn validator(&self, id: &str) -> bool {
    if id.is_empty() {
      return false;
    }

    if id.starts_with('\'') && id.ends_with('\'') {
      return true;
    }

    if fn_call_re().is_match(id) {
      return true;
    }

    let mut chars = id.chars();
    let first = chars.next().unwrap();
    if !(first.is_ascii_alphabetic() || first == '_') {
      return false;
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
  }
}

/// Recursively count leaf (file) nodes in a tree.
fn count_file_leaves(nodes: &[TreeNode]) -> usize {
  nodes.iter().map(|n| {
    match &n.children {
      Some(children) => count_file_leaves(children),
      None => 1,
    }
  }).sum()
}

/// Map a file extension to a stable node_type string for icon matching.
fn ext_to_node_type(ext: &str) -> &'static str {
  match ext {
    "parquet" => "parquet",
    "csv" => "csv",
    "tsv" => "tsv",
    "json" => "json",
    "jsonl" => "jsonl",
    "xlsx" => "xlsx",
    _ => "file",
  }
}

/// Build a hierarchical directory tree from a flat list of file paths.
///
/// Given paths like `["a/b/c.parquet", "a/d.csv", "e.json"]`, produces:
/// ```text
/// a/
///   b/
///     c.parquet
///   d.csv
/// e.json
/// ```
fn build_file_tree(paths: Vec<String>) -> Vec<TreeNode> {
  // Normalize separators to '/' and strip leading './' or '.'
  let normalized: Vec<String> = paths
    .iter()
    .map(|p| {
      let p = p.replace('\\', "/");
      p.strip_prefix("./")
        .or_else(|| p.strip_prefix('.'))
        .unwrap_or(&p)
        .to_string()
    })
    .collect();
  let split: Vec<Vec<&str>> = normalized
    .iter()
    .map(|p| p.split('/').collect())
    .collect();
  build_tree_from_segments(&split, &normalized)
}

fn build_tree_from_segments(segments: &[Vec<&str>], full_paths: &[String]) -> Vec<TreeNode> {
  if segments.is_empty() {
    return vec![];
  }

  // Group by first segment
  let mut groups: BTreeMap<&str, Vec<usize>> = BTreeMap::new();
  for (i, segs) in segments.iter().enumerate() {
    if let Some(first) = segs.first() {
      groups.entry(first).or_default().push(i);
    }
  }

  let mut nodes = Vec::new();

  for (name, indices) in &groups {
    // Check if all entries in this group are single-segment (i.e. leaf files)
    let all_leaves = indices.iter().all(|&i| segments[i].len() == 1);

    if all_leaves && indices.len() == 1 {
      // Single file leaf
      let idx = indices[0];
      let ext = Path::new(name)
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
      nodes.push(TreeNode {
        name: name.to_string(),
        path: full_paths[idx].clone(),
        node_type: ext_to_node_type(&ext).to_string(),
        schema: None,
        children: None,
        size: None,
        comment: None,
      });
    } else {
      // Directory node: collect remaining segments for children
      let child_segs: Vec<Vec<&str>> = indices
        .iter()
        .filter(|&&i| segments[i].len() > 1)
        .map(|&i| segments[i][1..].to_vec())
        .collect();
      let child_paths: Vec<String> = indices
        .iter()
        .filter(|&&i| full_paths[i].len() > 1)
        .map(|&i| full_paths[i].clone())
        .collect();

      // Determine the directory path from the common prefix
      let dir_path = if child_paths.is_empty() {
        name.to_string()
      } else {
        // Use the parent directory of the first child as the dir path
        Path::new(&child_paths[0])
          .parent()
          .map(|p| p.to_string_lossy().to_string().replace('\\', "/"))
          .unwrap_or_else(|| name.to_string())
      };

      let children = if child_segs.is_empty() {
        None
      } else {
        Some(build_tree_from_segments(&child_segs, &child_paths))
      };

      nodes.push(TreeNode {
        name: name.to_string(),
        path: dir_path,
        node_type: "path".to_string(),
        schema: None,
        children,
        size: None,
        comment: None,
      });
    }
  }

  sort_file_tree_children(&mut nodes);
  nodes
}

/// Directories (`node_type == "path"`) before file leaves; names alphabetical within each group.
fn sort_file_tree_children(nodes: &mut [TreeNode]) {
  nodes.sort_by(|a, b| {
    let a_dir = a.node_type == "path";
    let b_dir = b.node_type == "path";
    match (a_dir, b_dir) {
      (true, false) => std::cmp::Ordering::Less,
      (false, true) => std::cmp::Ordering::Greater,
      _ => a.name.cmp(&b.name),
    }
  });
  for n in nodes.iter_mut() {
    if let Some(children) = n.children.as_mut() {
      sort_file_tree_children(children);
    }
  }
}

/// Check if `table` is already a read_xxx() function call (frontend-prepared).
fn is_read_function(table: &str) -> bool {
  let t = table.trim_start();
  t.starts_with("read_parquet(")
    || t.starts_with("read_csv(")
    || t.starts_with("read_json(")
    || t.starts_with("read_xlsx(")
}

impl QuackConnection {
  pub(crate) fn connect(&self) -> anyhow::Result<DuckDbSyncConnection> {
    let conn = DuckDbSyncConnection::new(None, None)?;
    conn.inner.execute("INSTALL quack; LOAD quack;", duckdb::params![])?;
    Ok(conn)
  }

  pub(crate) fn wrap_sql(&self, query: &str) -> String {
    let uri = escape_sql_string(&self.uri);
    let query_quoted = dollar_quote(query);
    let mut args = vec![format!("'{uri}'"), query_quoted];

    if let Some(token) = &self.token {
      if !token.is_empty() {
        args.push(format!(
          "token => '{}'",
          escape_sql_string(token)
        ));
      }
    }

    args.push(format!("disable_ssl => {}", self.disable_ssl));

    format!("SELECT * FROM quack_query({})", args.join(", "))
  }

  fn get_tables(&self, conn: &DuckDbSyncConnection) -> anyhow::Result<Vec<Table>> {
    let sql = "
      SELECT table_catalog, table_schema, table_name, table_type
      FROM information_schema.tables
      ORDER BY table_type, table_name
    ";
    let wrapped = self.wrap_sql(sql);
    let mut stmt = conn.inner.prepare(&wrapped)?;
    let tables = stmt
      .query_map([], |row| {
        let table_type: String = row.get(3)?;
        Ok(Table {
          db_name: row.get(0)?,
          schema: row.get(1)?,
          table_name: row.get(2)?,
          table_type: table_type.clone(),
          r#type: if table_type == "VIEW" {
            "view".to_string()
          } else {
            "table".to_string()
          },
          size: None,
        })
      })?
        .flatten()
        .collect();
    Ok(tables)
  }

  fn databases(&self, conn: &DuckDbSyncConnection) -> anyhow::Result<Vec<String>> {
    let sql = "
      SELECT DISTINCT table_catalog
      FROM information_schema.tables
      ORDER BY table_catalog
    ";
    let wrapped = self.wrap_sql(sql);
    let mut stmt = conn.inner.prepare(&wrapped)?;
    let names = stmt
      .query_map([], |row| row.get(0))?
      .flatten()
      .collect();
    Ok(names)
  }

  fn get_files(&self, conn: &DuckDbSyncConnection) -> anyhow::Result<Vec<TreeNode>> {
    let glob_pattern = match &self.glob {
      Some(g) if !g.trim().is_empty() => g.trim().to_string(),
      _ => return Ok(vec![]),
    };
    // Array expression starts with '[' → inline directly; otherwise quote as string.
    let glob_expr = if glob_pattern.starts_with('[') {
      glob_pattern.clone()
    } else {
      format!("'{glob_pattern}'")
    };
    let sql = format!("SELECT * FROM glob({glob_expr})");
    let wrapped = self.wrap_sql(&sql);
    let mut stmt = conn.inner.prepare(&wrapped)?;
    let paths: Vec<String> = stmt
      .query_map([], |row| row.get(0))?
      .flatten()
      .collect();
    Ok(build_file_tree(paths))
  }

  fn fetch_all_columns(&self, conn: &DuckDbSyncConnection) -> anyhow::Result<Vec<Metadata>> {
    use std::collections::HashMap;

    let sql = "
      SELECT table_catalog, table_schema, table_name, column_name, data_type
      FROM information_schema.columns
      GROUP BY ALL
    ";
    let wrapped = self.wrap_sql(sql);
    let mut stmt = conn.inner.prepare(&wrapped)?;
    let rows = stmt.query_map([], |row| {
      Ok((
        row.get::<_, String>(0)?,
        row.get::<_, String>(2)?,
        row.get::<_, String>(3)?,
        row.get::<_, String>(4)?,
      ))
    })?;

    let mut table_map: HashMap<(String, String), Vec<(String, String)>> = HashMap::new();
    for row in rows {
      let (db, table, column, r#type) = row?;
      table_map
        .entry((db.clone(), table.clone()))
        .or_default()
        .push((column, r#type));
    }

    Ok(table_map
      .into_iter()
      .map(|((database, table), columns)| Metadata {
        database,
        table,
        columns,
      })
      .collect())
  }
}

fn escape_sql_string(value: &str) -> String {
  value.replace('\'', "''")
}

fn dollar_quote(value: &str) -> String {
  let mut tag = String::new();
  loop {
    let delimiter = format!("${tag}$");
    if !value.contains(&delimiter) {
      return format!("{delimiter}{value}{delimiter}");
    }
    tag.push('_');
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_wrap_sql() {
    let conn = QuackConnection {
      uri: "quack:remote.com".to_string(),
      token: Some("MY_QUACK_TOKEN_01234567890ABCDEF".to_string()),
      disable_ssl: true,
      glob: None,
    };
    let wrapped = conn.wrap_sql("SELECT 42");
    assert_eq!(
      wrapped,
      "SELECT * FROM quack_query('quack:remote.com', $$SELECT 42$$, token => 'MY_QUACK_TOKEN_01234567890ABCDEF', disable_ssl => true)"
    );
  }

  #[test]
  fn test_wrap_sql_without_token() {
    let conn = QuackConnection {
      uri: "quack:localhost".to_string(),
      token: None,
      disable_ssl: false,
      glob: None,
    };
    let wrapped = conn.wrap_sql("SELECT 1");
    assert_eq!(
      wrapped,
      "SELECT * FROM quack_query('quack:localhost', $$SELECT 1$$, disable_ssl => false)"
    );
  }

  #[test]
  fn test_build_file_tree() {
    let paths = vec![
      "data/sales/2024.parquet".to_string(),
      "data/sales/2025.parquet".to_string(),
      "data/reports/q1.csv".to_string(),
      "data/reports/q2.csv".to_string(),
      "single.json".to_string(),
    ];
    let tree = build_file_tree(paths);
    // top-level: "data" (dir) + "single.json" (file)
    assert_eq!(tree.len(), 2);
    assert_eq!(tree[1].name, "single.json");
    assert_eq!(tree[1].node_type, "json");
    // "data" dir
    assert_eq!(tree[0].name, "data");
    assert_eq!(tree[0].node_type, "path");
    let data_children = tree[0].children.as_ref().unwrap();
    assert_eq!(data_children.len(), 2); // "reports" + "sales"
    // total leaf count
    assert_eq!(count_file_leaves(&tree), 5);
  }

  #[test]
  fn test_build_file_tree_strips_dot_prefix() {
    let paths = vec![
      "./data/a.parquet".to_string(),
      "./data/b.parquet".to_string(),
      "./root.csv".to_string(),
    ];
    let tree = build_file_tree(paths);
    assert_eq!(tree.len(), 2);
    assert_eq!(tree[0].name, "data");
    assert_eq!(tree[0].node_type, "path");
    assert_eq!(tree[1].name, "root.csv");
    assert_eq!(count_file_leaves(&tree), 3);
  }

  #[test]
  fn test_build_file_tree_folders_before_files() {
    let paths = vec![
      "zebra.csv".to_string(),
      "alpha/x.parquet".to_string(),
      "beta/y.json".to_string(),
    ];
    let tree = build_file_tree(paths);
    assert_eq!(tree.len(), 3);
    assert_eq!(tree[0].name, "alpha");
    assert_eq!(tree[0].node_type, "path");
    assert_eq!(tree[1].name, "beta");
    assert_eq!(tree[1].node_type, "path");
    assert_eq!(tree[2].name, "zebra.csv");
    assert_eq!(tree[2].node_type, "csv");
  }

  #[test]
  fn test_build_file_tree_flat() {
    let paths = vec![
      "a.parquet".to_string(),
      "b.csv".to_string(),
    ];
    let tree = build_file_tree(paths);
    assert_eq!(tree.len(), 2);
    assert_eq!(tree[0].name, "a.parquet");
    assert_eq!(tree[0].node_type, "parquet");
    assert_eq!(tree[1].name, "b.csv");
    assert_eq!(count_file_leaves(&tree), 2);
  }
}
