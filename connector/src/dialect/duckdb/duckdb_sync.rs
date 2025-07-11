use crate::utils::{Metadata, RawArrowData};
use crate::utils::{Table, Title, TreeNode, build_tree, get_file_name};
use arrow::array::RecordBatch;
use std::collections::HashMap;

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

  pub(crate) fn set_cwd(&mut self, cwd: Option<String>) -> duckdb::Result<()> {
    self.cwd = cwd.clone();
    self.inner.execute(
      format!("SET file_search_path='{}'", cwd.unwrap_or_default()).as_str(),
      duckdb::params![],
    )?;
    Ok(())
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

  fn execute_batch(&self, sql: &str) -> anyhow::Result<()> {
    self.inner.execute_batch(sql)?;
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

  pub fn export(&self, sql: &str, file: &str, format: &str) -> anyhow::Result<()> {
    let _ = export(&self.inner, sql, file, format)?;
    Ok(())
  }
}

pub fn query(conn: &duckdb::Connection, sql: &str) -> anyhow::Result<RawArrowData> {
  println!("sql: {sql}");

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
      r#type: stmt.column_type(i).to_string(),
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
) -> anyhow::Result<()> {
  let sql = if format == "xlsx" {
    format!("INSTALL excel; LOAD excel; COPY ({sql}) TO '{file}' (FORMAT xlsx, HEADER true)")
  } else {
    format!("COPY ({sql}) TO '{file}' (FORMAT {format})")
  };
  let _ = conn.execute(&sql, [])?;
  Ok(())
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
