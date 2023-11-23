use duckdb::{params, Connection, Result};

use crate::dialect::sql;
use crate::dialect::{Dialect, TreeNode};

#[derive(Debug, Default)]
pub struct DuckDbDialect {
  path: String,
}

struct Table {
  table_name: String,
  table_type: String,
}

impl Dialect for DuckDbDialect {
  fn get_db(&self) -> Option<TreeNode> {
    let rows = sql::show_tables(self.path.clone());
    None
  }
}

pub fn get_tables(path: String) -> duckdb::Result<()> {
  let db = Connection::open(path)?;
  let sql = r#"select table_name, table_type from information_schema.tables order by table_type, table_name"#;
  let mut stmt = db.prepare(sql)?;

  let table_iter = stmt.query_map([], |row| {
    Ok(Table {
      table_name: row.get(0)?,
      table_type: row.get(1)?,
    })
  })?;

  let mut views = TreeNode {
    name: "views".to_string(),
    path: "views".to_string(),
    node_type: "path".to_string(),
    children: None,
  };

  let mut tables = TreeNode {
    name: "tables".to_string(),
    path: "tables".to_string(),
    node_type: "path".to_string(),
    children: None,
  };

  for table in table_iter {
    let t = table.unwrap();
    let node = TreeNode {
      name: t.table_name,
      path: "tables".to_string(),
      node_type: String::from(if t.table_type == "VIEW" {
        "view"
      } else {
        "table"
      }),
      children: None,
    };
    // if t.table_type == "VIEW" {
    //   views.children;
    // } else {
    //   tables.children;
    // }
  }
  Ok(())
}
