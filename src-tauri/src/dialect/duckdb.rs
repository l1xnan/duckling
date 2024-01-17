use std::path::{Path, PathBuf};

use duckdb::{params, Connection};

use crate::dialect::sql;
use crate::dialect::{Dialect, TreeNode};
use crate::utils::{get_file_name, Table};

#[derive(Debug, Default)]
pub struct DuckDbDialect {
  pub path: String,
}

impl Dialect for DuckDbDialect {
  async fn get_db(&self) -> Option<TreeNode> {
    if let Ok(tables) = get_tables(&self.path) {
      Some(get_db(&self.path, tables))
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
}

pub fn get_tables(path: &str) -> anyhow::Result<Vec<Table>> {
  let db = Connection::open(path)?;
  let sql = r#"
  select table_name, table_type, table_schema
  from information_schema.tables order by table_type, table_name
  "#;
  let mut stmt = db.prepare(sql)?;

  let rows = stmt.query_map([], |row| {
    Ok(Table {
      table_name: row.get(0)?,
      table_type: row.get(1)?,
      table_schema: row.get(2)?,
    })
  })?;

  let mut tables = Vec::new();
  for row in rows {
    tables.push(row?);
  }
  Ok(tables)
}

pub fn get_db(path: &str, tables: Vec<Table>) -> TreeNode {
  let mut views_children = vec![];
  let mut tables_children = vec![];

  for t in tables {
    let node = TreeNode {
      name: t.table_name.clone(),
      path: t.table_name.clone(),
      node_type: String::from(if t.table_type == "VIEW" {
        "view"
      } else {
        "table"
      }),
      children: None,
    };
    if t.table_type == "VIEW" {
      views_children.push(node);
    } else {
      tables_children.push(node);
    }
  }
  TreeNode {
    name: get_file_name(path),
    path: path.to_string(),
    node_type: "database".to_string(),
    children: Some(vec![
      TreeNode {
        name: "tables".to_string(),
        path: "tables".to_string(),
        node_type: "path".to_string(),
        children: Some(tables_children),
      },
      TreeNode {
        name: "views".to_string(),
        path: "views".to_string(),
        node_type: "path".to_string(),
        children: Some(views_children),
      },
    ]),
  }
}
