use crate::utils::{build_tree, get_file_name, Table, Title, TreeNode};
use crate::utils::{Metadata, RawArrowData};
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
    let sql =
      "select table_catalog, table_schema, table_name, column_name from information_schema.columns";
    let mut stmt = self.inner.prepare(sql)?;

    let rows = stmt.query_map([], |row| {
      Ok((
        row.get::<_, String>(0)?, // database
        row.get::<_, String>(2)?, // table_name
        row.get::<_, String>(3)?, // column_name
      ))
    })?;

    let mut metadata = Vec::new();
    for row in rows {
      let (database, table, column) = row?;
      metadata.push(Metadata {
        database,
        table,
        column,
      });
    }
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
    select table_name, table_type, table_schema, if(table_type='VIEW', 'view', 'table') as type
    from information_schema.tables order by table_type, table_name";

    let mut stmt = self.inner.prepare(sql)?;

    let tables = stmt
      .query_map([], |row| {
        Ok(Table {
          table_name: row.get(0)?,
          table_type: row.get(1)?,
          db_name: row.get(2)?,
          r#type: row.get(3)?,
          size: None,
          schema: None,
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
