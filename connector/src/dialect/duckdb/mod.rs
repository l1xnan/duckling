use crate::api;
use crate::api::RawArrowData;
use crate::dialect::Connection;
use crate::utils::{build_tree, get_file_name, write_csv, Table, TreeNode};
use async_trait::async_trait;
use std::collections::HashMap;
use std::env::{current_dir, set_current_dir};

#[derive(Debug, Default)]
pub struct DuckDbConnection {
  pub path: String,
  pub cwd: Option<String>,
}

#[async_trait]
impl Connection for DuckDbConnection {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let conn = self.connect()?;
    let tables = get_tables(&conn, None)?;
    Ok(TreeNode {
      name: get_file_name(&self.path),
      path: self.path.clone(),
      node_type: "root".to_string(),
      children: Some(build_tree(tables)),
      size: None,
      comment: None,
    })
  }

  async fn query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    api::query(&self.path, sql, 0, 0, self.cwd.clone())
  }

  #[allow(clippy::unused_async)]
  async fn query_count(&self, sql: &str) -> anyhow::Result<usize> {
    let conn = self.connect()?;
    let total = conn.query_row(sql, [], |row| row.get::<_, usize>(0))?;
    Ok(total)
  }

  fn dialect(&self) -> &'static str {
    "duckdb"
  }

  async fn show_schema(&self, schema: &str) -> anyhow::Result<RawArrowData> {
    let sql = format!(
      "select * from information_schema.tables where table_schema='{schema}' order by table_type, table_name"
    );

    self.query(&sql, 0, 0).await
  }

  async fn show_column(&self, schema: Option<&str>, table: &str) -> anyhow::Result<RawArrowData> {
    let (db, tbl) = if schema.is_none() && table.contains('.') {
      let parts: Vec<&str> = table.splitn(2, '.').collect();
      (parts[0], parts[1])
    } else {
      ("", table)
    };
    let sql = format!(
      "select * from information_schema.columns where table_schema='{db}' and table_name='{tbl}'"
    );
    log::info!("show columns: {}", &sql);
    self.query(&sql, 0, 0).await
  }

  async fn drop_table(&self, schema: Option<&str>, table: &str) -> anyhow::Result<String> {
    let (db, tbl) = if schema.is_none() && table.contains('.') {
      let parts: Vec<&str> = table.splitn(2, '.').collect();
      (parts[0], parts[1])
    } else {
      ("", table)
    };

    let table_name = if db.is_empty() {
      tbl.to_string()
    } else {
      format!("{db}.{tbl}")
    };

    let sql = format!("DROP VIEW IF EXISTS {table_name}");
    log::warn!("drop: {}", &sql);
    // TODO: raw query
    let _ = self.execute(&sql);
    let sql = format!("DROP TABLE IF EXISTS {table_name}");
    let _ = self.execute(&sql);
    Ok(String::new())
  }

  async fn all_columns(&self) -> anyhow::Result<HashMap<String, Vec<String>>> {
    let columns = self._all_columns()?;
    Ok(columns)
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let conn = self.connect()?;
    let sql = self._table_count_sql(table, r#where);
    let total = conn.query_row(&sql, [], |row| row.get::<_, usize>(0))?;
    Ok(total)
  }

  fn normalize(&self, name: &str) -> String {
    if name.contains(' ') {
      format!("\"{name}\"")
    } else {
      name.to_string()
    }
  }

  async fn export(&self, sql: &str, file: &str) {
    let data = api::fetch_all(&self.path, sql, self.cwd.clone());
    if let Ok(batch) = data {
      write_csv(file, &batch);
    }
  }

  async fn execute(&self, sql: &str) -> anyhow::Result<usize> {
    if let Some(cwd) = &self.cwd {
      let _ = set_current_dir(cwd);
    }
    log::info!("current_dir: {}", current_dir()?.display());
    let con = if self.path == ":memory:" {
      duckdb::Connection::open_in_memory()?
    } else {
      duckdb::Connection::open(&self.path)?
    };
    let res = con.execute(sql, [])?;
    Ok(res)
  }
}

impl DuckDbConnection {
  fn connect(&self) -> anyhow::Result<duckdb::Connection> {
    Ok(duckdb::Connection::open(&self.path)?)
  }

  fn new(path: &str) -> Self {
    Self {
      path: path.to_string(),
      cwd: None,
    }
  }

  fn set_cwd(&mut self, cwd: Option<String>) {
    self.cwd = cwd;
  }

  fn _all_columns(&self) -> anyhow::Result<HashMap<String, Vec<String>>> {
    let sql =
      "select table_catalog, table_schema, table_name, column_name from information_schema.columns";
    let conn = self.connect()?;
    let mut stmt = conn.prepare(sql)?;

    let rows = stmt.query_map([], |row| {
      // 提取 table_name 和 column_name
      Ok((
        row.get::<_, String>(2)?, // table_name
        row.get::<_, String>(3)?, // column_name
      ))
    })?;

    let mut table_columns: HashMap<String, Vec<String>> = HashMap::new();
    for row in rows {
      let (table_name, column_name) = row?;
      table_columns
        .entry(table_name)
        .or_default()
        .push(column_name);
    }
    Ok(table_columns)
  }
}

pub fn get_tables(conn: &duckdb::Connection, schema: Option<&str>) -> anyhow::Result<Vec<Table>> {
  let mut sql = r"
  select table_name, table_type, table_schema, if(table_type='VIEW', 'view', 'table') as type
  from information_schema.tables
  "
  .to_string();
  if let Some(schema) = schema {
    sql += &format!(" where table_schema='{schema}'");
  }
  sql += " order by table_type, table_name";

  let mut stmt = conn.prepare(&sql)?;

  let rows = stmt.query_map([], |row| {
    Ok(Table {
      table_name: row.get(0)?,
      table_type: row.get(1)?,
      db_name: row.get(2)?,
      r#type: row.get(3)?,
      size: None,
      schema: None,
    })
  })?;

  let mut tables = Vec::new();
  for row in rows {
    tables.push(row?);
  }
  Ok(tables)
}

#[tokio::test]
async fn test_duckdb() {
  use arrow::util::pretty::print_batches;

  let path = r"test.duckdb";
  let d = DuckDbConnection::new(path);
  let res = d.query("", 0, 0).await.unwrap();
  print_batches(&[res.batch]);
}
