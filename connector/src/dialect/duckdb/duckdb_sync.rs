use crate::utils::{Metadata, RawArrowData};
use crate::utils::{Table, Title, TreeNode, build_tree, get_file_name};
use arrow::array::RecordBatch;
use arrow::datatypes::DataType;
use arrow::datatypes::FieldRef;
use std::collections::HashMap;
use std::fmt;

#[derive(Debug)]
pub struct DuckDbSyncConnection {
  pub(crate) inner: duckdb::Connection,
  pub path: String,
  pub cwd: Option<String>,
}

impl DuckDbSyncConnection {
  pub(crate) fn new(path: Option<String>, cwd: Option<String>) -> duckdb::Result<Self> {
    let cfg = duckdb::Config::default();
    let path = path.unwrap_or(":memory:".to_string());
    let inner = duckdb::Connection::open_with_flags(&path, cfg)?;
    if let Some(_cwd) = cwd.clone() {
      inner.execute(
        format!("SET file_search_path='{_cwd}'").as_str(),
        duckdb::params![],
      )?;
    }
    Ok(Self { path, inner, cwd })
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
