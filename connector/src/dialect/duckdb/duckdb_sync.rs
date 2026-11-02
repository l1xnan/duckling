use crate::utils::{FunctionMeta, Metadata, RawArrowData};
use crate::utils::{Table, Title, TreeNode, build_tree, get_file_name};
use arrow::array::RecordBatch;
use arrow::datatypes::DataType;
use arrow::datatypes::FieldRef;
use duckdb::ffi;
use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::fmt;
use std::os::raw::c_char;
use std::ptr;
use std::sync::OnceLock;

/// DuckDB opens database files with an exclusive OS lock, so opening the same
/// file twice (even in one process) fails. All file connections go through one
/// process-wide instance cache instead, which keeps a single database instance
/// and lets each operation use its own SQL session.
fn instance_cache() -> ffi::duckdb_instance_cache {
  // Held as `usize` so the `OnceLock` stays `Sync`; DuckDB's cache is thread-safe.
  static CACHE: OnceLock<usize> = OnceLock::new();
  *CACHE.get_or_init(|| unsafe { ffi::duckdb_create_instance_cache() as usize })
    as ffi::duckdb_instance_cache
}

#[derive(Debug)]
struct CachedDatabase(ffi::duckdb_database);

unsafe impl Send for CachedDatabase {}

impl Drop for CachedDatabase {
  fn drop(&mut self) {
    if !self.0.is_null() {
      unsafe { ffi::duckdb_close(&mut self.0) };
    }
  }
}

fn open_shared(path: &str) -> duckdb::Result<(duckdb::Connection, CachedDatabase)> {
  let c_path = CString::new(path)?;
  let mut db: ffi::duckdb_database = ptr::null_mut();
  let mut err: *mut c_char = ptr::null_mut();
  let state = unsafe {
    ffi::duckdb_get_or_create_from_cache(
      instance_cache(),
      c_path.as_ptr(),
      &mut db,
      ptr::null_mut(),
      &mut err,
    )
  };
  if state != ffi::DuckDBSuccess {
    let message = if err.is_null() {
      None
    } else {
      let message = unsafe { CStr::from_ptr(err) }
        .to_string_lossy()
        .into_owned();
      unsafe { ffi::duckdb_free(err as *mut std::ffi::c_void) };
      Some(message)
    };
    return Err(duckdb::Error::DuckDBFailure(
      ffi::Error::new(state),
      message,
    ));
  }
  let inner = match unsafe { duckdb::Connection::open_from_raw(db) } {
    Ok(inner) => inner,
    Err(error) => {
      unsafe { ffi::duckdb_close(&mut db) };
      return Err(error);
    }
  };
  Ok((inner, CachedDatabase(db)))
}

#[derive(Debug)]
pub struct DuckDbSyncConnection {
  pub(crate) inner: duckdb::Connection,
  /// Keeps the shared instance alive until `inner` is dropped.
  _db: Option<CachedDatabase>,
  pub path: String,
  pub cwd: Option<String>,
}

impl DuckDbSyncConnection {
  pub(crate) fn new(path: Option<String>, cwd: Option<String>) -> duckdb::Result<Self> {
    let path = path.unwrap_or(":memory:".to_string());
    let (inner, db) = if path.is_empty() || path == ":memory:" {
      (duckdb::Connection::open_in_memory()?, None)
    } else {
      let (inner, db) = open_shared(&path)?;
      (inner, Some(db))
    };
    if let Some(_cwd) = cwd.clone() {
      inner.execute(
        format!("SET file_search_path='{_cwd}'").as_str(),
        duckdb::params![],
      )?;
    }
    Ok(Self {
      path,
      inner,
      _db: db,
      cwd,
    })
  }

  pub(crate) fn show_schema(&self, schema: &str) -> anyhow::Result<RecordBatch> {
    let sql = format!(
      "select * from information_schema.tables where table_schema='{schema}' order by table_type, table_name"
    );
    self.query_arrow(&sql)
  }
  pub fn all_columns(&self) -> anyhow::Result<Vec<Metadata>> {
    let sql = "
    select table_catalog, table_schema, table_name, column_name, data_type
    from information_schema.columns
    group by all
    ";
    let mut stmt = self.inner.prepare(sql)?;

    let rows = stmt.query_map([], |row| {
      Ok((
        row.get::<_, String>(0)?, // database
        row.get::<_, String>(2)?, // table_name
        row.get::<_, String>(3)?, // column_name
        row.get::<_, String>(4)?, // column_type
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

    let metadata = table_map
      .into_iter()
      .map(|((database, table), columns)| Metadata {
        database,
        table,
        columns,
      })
      .collect();
    Ok(metadata)
  }

  pub fn drop_table(&self, table: &str) -> anyhow::Result<()> {
    let sql = format!("DROP VIEW IF EXISTS {table}");
    log::warn!("drop: {}", &sql);
    self.inner.execute(&sql, [])?;
    let sql = format!("DROP TABLE IF EXISTS {table}");
    log::warn!("drop: {}", &sql);
    self.inner.execute(&sql, [])?;
    Ok(())
  }

  pub fn get_tables(&self) -> anyhow::Result<Vec<Table>> {
    let sql = r"
    select table_catalog, table_schema, table_name, table_type, if(table_type='VIEW', 'view', 'table') as type
    from information_schema.tables order by table_type, table_name";

    let mut stmt = self.inner.prepare(sql)?;

    let tables = stmt
      .query_map([], |row| {
        Ok(Table {
          db_name: row.get(0)?,
          schema: row.get(1)?,
          table_name: row.get(2)?,
          table_type: row.get(3)?,
          r#type: row.get(4)?,
          size: None,
        })
      })?
      .flatten()
      .collect::<Vec<_>>();
    Ok(tables)
  }

  pub fn get_db(&self) -> anyhow::Result<TreeNode> {
    let tables = self.get_tables()?;
    Ok(TreeNode {
      name: get_file_name(&self.path),
      path: self.path.clone(),
      node_type: "root".to_string(),
      schema: None,
      children: Some(build_tree(tables)),
      size: None,
      comment: None,
    })
  }

  pub fn functions(&self) -> anyhow::Result<Vec<FunctionMeta>> {
    list_functions(&self.inner)
  }
  pub fn query(&self, sql: &str) -> anyhow::Result<(Vec<Title>, RecordBatch)> {
    let mut stmt = self.inner.prepare(sql)?;
    let frames = stmt.query_arrow(duckdb::params![])?;
    let schema = frames.get_schema();
    let records: Vec<_> = frames.collect();

    let titles: Vec<_> = stmt
      .column_names()
      .iter()
      .enumerate()
      .map(|(i, name)| Title {
        name: name.clone(),
        r#type: stmt.column_type(i).to_string(),
      })
      .collect();

    let batch = arrow::compute::concat_batches(&schema, &records)?;
    Ok((titles, batch))
  }
  pub fn query_arrow(&self, sql: &str) -> anyhow::Result<RecordBatch> {
    let mut stmt = self.inner.prepare(sql)?;
    let frames = stmt.query_arrow(duckdb::params![])?;
    let schema = frames.get_schema();
    let records: Vec<_> = frames.collect();
    let batch = arrow::compute::concat_batches(&schema, &records)?;
    Ok(batch)
  }

  pub fn export(
    &self,
    sql: &str,
    file: &str,
    format: &str,
    options: &crate::utils::ExportOptions,
  ) -> anyhow::Result<()> {
    let _ = export(&self.inner, sql, file, format, options)?;
    Ok(())
  }
}

pub struct MyDataType(pub DataType);

impl MyDataType {
  fn fmt_field_ref(f: &mut fmt::Formatter<'_>, field: &FieldRef) -> fmt::Result {
    write!(
      f,
      "{}: {}",
      field.name(),
      MyDataType(field.data_type().clone())
    )
  }
  fn fmt_field_ref_type(f: &mut fmt::Formatter<'_>, field: &FieldRef) -> fmt::Result {
    write!(f, "{}", MyDataType(field.data_type().clone()))
  }
}

impl fmt::Display for MyDataType {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match &self.0 {
      DataType::Struct(fields) => {
        write!(f, "Struct<{{")?;
        for (i, field) in fields.iter().enumerate() {
          if i > 0 {
            write!(f, ", ")?;
          }
          Self::fmt_field_ref(f, field)?;
        }
        write!(f, "}}>")
      }

      DataType::List(field) => {
        write!(f, "List<")?;
        Self::fmt_field_ref_type(f, field)?;
        write!(f, ">")
      }

      DataType::LargeList(field) => {
        write!(f, "LargeList<")?;
        Self::fmt_field_ref_type(f, field)?;
        write!(f, ">")
      }

      DataType::Map(field, sorted) => {
        write!(f, "Map<")?;
        Self::fmt_field_ref(f, field)?;
        write!(f, ">(sorted={})", sorted)
      }

      DataType::Utf8 => write!(f, "String"),
      DataType::LargeUtf8 => write!(f, "String"),
      // 其余类型保持默认 Debug 输出
      _ => write!(f, "{:?}", self.0),
    }
  }
}

/// List all functions (incl. extension/table functions) from `duckdb_functions()`.
pub(crate) fn list_functions(conn: &duckdb::Connection) -> anyhow::Result<Vec<FunctionMeta>> {
  let sql = "
    select function_name, function_type
    from duckdb_functions()
    group by function_name, function_type
    order by function_name
  ";
  let mut stmt = conn.prepare(sql)?;
  let rows = stmt.query_map([], |row| {
    Ok((
      row.get::<_, String>(0)?,
      row.get::<_, String>(1)?,
    ))
  })?;

  let mut seen = std::collections::HashSet::new();
  let mut out = Vec::new();
  for row in rows {
    let (name, kind) = row?;
    // Skip operators catalogued as functions (`!~~`, `%`, `&&`, `!__postfix`).
    if !is_completion_function_name(&name) {
      continue;
    }
    if seen.insert(name.to_lowercase()) {
      out.push(FunctionMeta {
        name,
        kind: Some(kind),
      });
    }
  }
  Ok(out)
}

fn is_completion_function_name(name: &str) -> bool {
  let mut chars = name.chars();
  match chars.next() {
    Some(c) if c.is_ascii_alphabetic() || c == '_' => {}
    _ => return false,
  }
  chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

pub fn query(conn: &duckdb::Connection, sql: &str) -> anyhow::Result<RawArrowData> {
  log::debug!("sql: {sql}");

  let mut stmt = conn.prepare(sql)?;
  let frames = stmt.query_arrow([])?;
  let schema = frames.get_schema();
  let records: Vec<_> = frames.collect();

  let titles: Vec<_> = stmt
    .column_names()
    .iter()
    .enumerate()
    .map(|(i, name)| Title {
      name: name.clone(),
      r#type: MyDataType(stmt.column_type(i)).to_string(),
    })
    .collect();

  let batch = arrow::compute::concat_batches(&schema, &records)?;
  let total = batch.num_rows();
  let batch = crate::utils::finalize_preview_batch(batch)?;

  Ok(RawArrowData {
    total,
    batch,
    titles: Some(titles),
    sql: Some(sql.to_string()),
  })
}

pub fn export(
  conn: &duckdb::Connection,
  sql: &str,
  file: &str,
  format: &str,
  options: &crate::utils::ExportOptions,
) -> anyhow::Result<()> {
  let file_sql = file.replace('\'', "''");
  let sql = build_copy_sql(sql, &file_sql, format, options)?;
  log::warn!("export sql: {}", &sql);
  conn.execute(&sql, [])?;
  Ok(())
}

fn escape_sql_char_literal(value: &str) -> String {
  value.replace('\'', "''")
}

/// Build DuckDB `COPY (...) TO` SQL for streaming export (no full materialization).
pub(crate) fn build_copy_sql(
  sql: &str,
  file: &str,
  format: &str,
  options: &crate::utils::ExportOptions,
) -> anyhow::Result<String> {
  let format_lower = format.to_ascii_lowercase();
  Ok(match format_lower.as_str() {
    "xlsx" => {
      format!(
        "INSTALL excel; LOAD excel; COPY ({sql}) TO '{file}' (FORMAT xlsx, HEADER true)"
      )
    }
    "parquet" => {
      let compression = options
        .compression
        .as_deref()
        .unwrap_or("zstd")
        .to_ascii_uppercase();
      let mut opts = vec![
        "FORMAT PARQUET".to_string(),
        format!("COMPRESSION '{compression}'"),
      ];
      if let Some(level) = options.compression_level {
        let supports_level = matches!(
          compression.as_str(),
          "ZSTD" | "GZIP" | "BROTLI"
        );
        if supports_level {
          opts.push(format!("COMPRESSION_LEVEL {level}"));
        }
      }
      format!("COPY ({sql}) TO '{file}' ({})", opts.join(", "))
    }
    "json" => {
      let mut opts = vec!["FORMAT JSON".to_string()];
      if options.json_array.unwrap_or(true) {
        opts.push("ARRAY true".to_string());
      }
      format!("COPY ({sql}) TO '{file}' ({})", opts.join(", "))
    }
    "tsv" | "csv" => {
      let header = options.header.unwrap_or(true);
      let delimiter = if format_lower == "tsv" {
        options
          .delimiter
          .clone()
          .unwrap_or_else(|| "\\t".to_string())
      } else {
        options
          .delimiter
          .clone()
          .unwrap_or_else(|| ",".to_string())
      };
      let delim = match delimiter.as_str() {
        "\\t" | "\t" | "tab" | "TAB" => "\\t".to_string(),
        other => escape_sql_char_literal(other),
      };
      let mut opts = vec![
        "FORMAT CSV".to_string(),
        format!("HEADER {header}"),
        format!("DELIMITER '{delim}'"),
      ];
      if let Some(quote) = options.quote.as_deref().filter(|q| !q.is_empty()) {
        let q = quote.chars().next().unwrap_or('"');
        let q_sql = if q == '\'' {
          "''".to_string()
        } else {
          q.to_string()
        };
        opts.push(format!("QUOTE '{q_sql}'"));
      }
      format!("COPY ({sql}) TO '{file}' ({})", opts.join(", "))
    }
    other => {
      format!("COPY ({sql}) TO '{file}' (FORMAT {other})")
    }
  })
}

#[test]
fn test_duckdb_cwd() {
  let cwd = Some("/path/to".to_string());
  let conn = DuckDbSyncConnection::new(None, cwd).unwrap();
  let sql = "select value from duckdb_settings() where name='file_search_path'";
  let value = conn
    .inner
    .query_row(sql, [], |row| row.get::<_, String>(0))
    .unwrap();
  assert_eq!(value, "/path/to");
}

#[test]
fn test_duckdb_functions_lists_builtins() {
  let conn = DuckDbSyncConnection::new(None, None).unwrap();
  let fns = conn.functions().unwrap();
  assert!(fns.len() > 50);
  let names: std::collections::HashSet<&str> =
    fns.iter().map(|f| f.name.as_str()).collect();
  for required in ["sum", "count", "strftime", "date_diff", "read_parquet"] {
    assert!(
      names.contains(required),
      "duckdb_functions() missing {required}"
    );
  }
  for f in &fns {
    assert!(
      is_completion_function_name(&f.name),
      "operator-like function leaked into completion list: {}",
      f.name
    );
  }
}

#[test]
fn test_completion_function_name_rejects_operators() {
  for name in ["!__postfix", "!~~", "!~~*", "%", "&", "&&", "||", "->>"] {
    assert!(
      !is_completion_function_name(name),
      "{name} should not be a completion identifier"
    );
  }
  assert!(is_completion_function_name("count"));
  assert!(is_completion_function_name("read_parquet"));
  assert!(is_completion_function_name("_internal"));
}

#[test]
fn build_copy_sql_csv_and_parquet() {
  let opts = crate::utils::ExportOptions::default();
  let csv = build_copy_sql("select 1 as a", "out.csv", "csv", &opts).unwrap();
  assert!(csv.contains("COPY (select 1 as a) TO 'out.csv'"));
  assert!(csv.contains("FORMAT CSV"));
  assert!(csv.contains("HEADER true"));

  let mut opts2 = opts.clone();
  opts2.header = Some(false);
  opts2.delimiter = Some("|".into());
  let csv2 = build_copy_sql("select 1", "out.csv", "csv", &opts2).unwrap();
  assert!(csv2.contains("HEADER false"));
  assert!(csv2.contains("DELIMITER '|'"));

  let pq = build_copy_sql("select 1", "out.parquet", "parquet", &opts).unwrap();
  assert!(pq.contains("FORMAT PARQUET"));
  assert!(pq.contains("COMPRESSION 'ZSTD'"));
}

#[test]
fn export_csv_streams_without_materializing_preview() {
  let dir = std::env::temp_dir().join(format!("duckling_export_{}", nanoid::nanoid!(8)));
  let _ = std::fs::create_dir_all(&dir);
  let out = dir.join("t.csv");
  let conn = DuckDbSyncConnection::new(None, None).unwrap();
  export(
    &conn.inner,
    "select 1 as id, 'hello' as name",
    out.to_str().unwrap(),
    "csv",
    &crate::utils::ExportOptions {
      header: Some(true),
      ..Default::default()
    },
  )
  .unwrap();
  let content = std::fs::read_to_string(&out).unwrap();
  assert!(content.contains("id") || content.contains("1"));
  assert!(content.contains("hello"));
  let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn shares_one_instance_per_duckdb_file() {
  let dir = std::env::temp_dir().join(format!("duckling_duckdb_shared_{}", nanoid::nanoid!(8)));
  let _ = std::fs::create_dir_all(&dir);
  let path = dir.join("shared.duckdb").to_string_lossy().to_string();

  let first = DuckDbSyncConnection::new(Some(path.clone()), None).unwrap();
  first
    .inner
    .execute_batch("create table t(i integer); insert into t values (1)")
    .unwrap();

  // Holding the first connection open used to hit the exclusive file lock.
  let second = DuckDbSyncConnection::new(Some(path.clone()), None).unwrap();
  let count: i64 = second
    .inner
    .query_row("select count(*) from t", [], |row| row.get(0))
    .unwrap();
  assert_eq!(count, 1);

  drop(first);
  drop(second);

  // The file is released once the last connection is gone.
  let third = DuckDbSyncConnection::new(Some(path), None).unwrap();
  let count: i64 = third
    .inner
    .query_row("select count(*) from t", [], |row| row.get(0))
    .unwrap();
  assert_eq!(count, 1);
  drop(third);

  let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn concurrent_connections_share_one_duckdb_file() {
  let dir = std::env::temp_dir().join(format!("duckling_duckdb_parallel_{}", nanoid::nanoid!(8)));
  let _ = std::fs::create_dir_all(&dir);
  let path = dir.join("parallel.duckdb").to_string_lossy().to_string();

  let seed = DuckDbSyncConnection::new(Some(path.clone()), None).unwrap();
  seed
    .inner
    .execute_batch("create table t(i integer); insert into t values (1), (2)")
    .unwrap();
  drop(seed);

  let handles: Vec<_> = (0..4)
    .map(|_| {
      let path = path.clone();
      std::thread::spawn(move || -> Result<i64, String> {
        let conn = DuckDbSyncConnection::new(Some(path), None).map_err(|e| e.to_string())?;
        conn
          .inner
          .query_row("select count(*) from t", [], |row| row.get(0))
          .map_err(|e| e.to_string())
      })
    })
    .collect();

  for handle in handles {
    assert_eq!(handle.join().unwrap().unwrap(), 2);
  }

  let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn in_memory_connections_stay_isolated() {
  let first = DuckDbSyncConnection::new(None, None).unwrap();
  let second = DuckDbSyncConnection::new(None, None).unwrap();
  first
    .inner
    .execute_batch("create table only_in_first(i integer)")
    .unwrap();
  assert!(second.inner.prepare("select * from only_in_first").is_err());
}
