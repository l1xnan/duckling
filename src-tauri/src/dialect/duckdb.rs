use async_trait::async_trait;

use crate::api;
use crate::api::RawArrowData;
use crate::dialect::{Connection, TreeNode};
use crate::utils::{build_tree, get_file_name, write_csv, Table};

#[derive(Debug, Default)]
pub struct DuckDbDialect {
  pub path: String,
  pub cwd: Option<String>,
}

#[async_trait]
impl Connection for DuckDbDialect {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let conn = self.connect()?;
    let tables = get_tables(&conn)?;
    Ok(TreeNode {
      name: get_file_name(&self.path),
      path: self.path.clone(),
      node_type: "root".to_string(),
      children: Some(build_tree(tables)),
      size: None,
      comment: None,
    })
  }

  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<RawArrowData> {
    api::query(&self.path, sql, 0, 0, self.cwd.clone())
  }

  async fn export(&self, sql: &str, file: &str) {
    let data = api::fetch_all(&self.path, sql, self.cwd.clone());
    if let Ok(batch) = data {
      write_csv(file, &batch);
    }
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let conn = self.connect()?;
    let sql = self._table_count_sql(table, r#where);
    let total = conn.query_row(&sql, [], |row| row.get::<_, usize>(0))?;
    Ok(total)
  }
}

impl DuckDbDialect {
  fn connect(&self) -> anyhow::Result<duckdb::Connection> {
    Ok(duckdb::Connection::open(&self.path)?)
  }
}

pub fn get_tables(conn: &duckdb::Connection) -> anyhow::Result<Vec<Table>> {
  let sql = r#"
  select table_name, table_type, table_schema, if(table_type='VIEW', 'view', 'table') as type
  from information_schema.tables order by table_type, table_name
  "#;
  let mut stmt = conn.prepare(sql)?;

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
