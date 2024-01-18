use std::env::{current_dir, set_current_dir};
use std::path::{Path, PathBuf};

use duckdb::{params, Connection};

use crate::api::{serialize_preview, ArrowData};
use crate::dialect::sql;
use crate::dialect::{Dialect, TreeNode};
use crate::utils::{build_tree, get_file_name, Table};

#[derive(Debug, Default)]
pub struct DuckDbDialect {
  pub path: String,
  pub cwd: Option<String>,
}

impl Dialect for DuckDbDialect {
  async fn get_db(&self) -> Option<TreeNode> {
    if let Ok(tables) = get_tables(&self.path) {
      Some(TreeNode {
        name: get_file_name(&self.path),
        path: self.path.clone(),
        node_type: "root".to_string(),
        children: Some(build_tree(tables)),
      })
    } else {
      None
    }
  }
}

impl DuckDbDialect {
  fn get_schema(&self) -> Vec<Table> {
    if let Ok(tables) = get_tables(&self.path) {
      tables
    } else {
      vec![]
    }
  }

  fn connect(&self) -> anyhow::Result<Connection> {
    Ok(Connection::open(&self.path)?)
  }

  pub fn query(&self, sql: String, limit: usize, offset: usize) -> anyhow::Result<ArrowData> {
    if let Some(cwd) = &self.cwd {
      let _ = set_current_dir(cwd);
    }
    log::info!("current_dir: {}", current_dir()?.display());
    let con = self.connect();
    let db = con.map_err(|err| anyhow::anyhow!("Failed to open database connection: {}", err))?;

    println!("sql: {}", sql);

    // query
    let mut stmt = db.prepare(sql.as_str())?;
    let frames = stmt.query_arrow(duckdb::params![])?;
    let schema = frames.get_schema();
    let records: Vec<_> = frames.collect();

    let record_batch = arrow::compute::concat_batches(&schema, &records)?;
    let total = record_batch.num_rows();
    let preview = record_batch.slice(offset, std::cmp::min(limit, total - offset));

    Ok(ArrowData {
      total_count: total,
      preview: serialize_preview(&preview)?,
    })
  }
}

pub fn get_tables(path: &str) -> anyhow::Result<Vec<Table>> {
  let db = Connection::open(path)?;
  let sql = r#"
  select table_name, table_type, table_schema, if(table_type='VIEW', 'view', 'table') as type
  from information_schema.tables order by table_type, table_name
  "#;
  let mut stmt = db.prepare(sql)?;

  let rows = stmt.query_map([], |row| {
    Ok(Table {
      table_name: row.get(0)?,
      table_type: row.get(1)?,
      table_schema: row.get(2)?,
      r#type: row.get(3)?,
    })
  })?;

  let mut tables = Vec::new();
  for row in rows {
    tables.push(row?);
  }
  Ok(tables)
}
