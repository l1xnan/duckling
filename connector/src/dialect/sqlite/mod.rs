mod type_arrow;

use std::sync::Arc;

use arrow::datatypes::{Field, Schema};
use async_trait::async_trait;
use rusqlite::Statement;
use rusqlite::fallible_iterator::FallibleIterator;

use crate::dialect::Connection;
use crate::dialect::sqlite::type_arrow::{db_result_to_arrow, db_to_arrow_type};
use crate::utils::{Metadata, RawArrowData};
use crate::utils::{Table, Title, TreeNode, build_tree, get_file_name};

#[derive(Debug, Default)]
pub struct SqliteConnection {
  pub path: String,
}

pub struct SQLiteStatement<'conn> {
  pub stmt: Statement<'conn>,
}

#[async_trait]
impl Connection for SqliteConnection {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let path = self.path.clone();
    crate::dialect::run_blocking(move || {
      let this = SqliteConnection { path: path.clone() };
      let tables = this.get_tables()?;
      let tree = build_tree(tables);
      let children = if tree.is_empty() {
        None
      } else {
        tree[0].children.clone()
      };
      Ok(TreeNode {
        name: get_file_name(&path),
        path,
        node_type: "root".to_string(),
        children,
        schema: None,
        size: None,
        comment: None,
      })
    })
    .await
  }

  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<RawArrowData> {
    let path = self.path.clone();
    let sql = sql.to_string();
    crate::dialect::run_blocking(move || {
      let conn = SqliteConnection { path };
      conn._query(&sql, limit, offset)
    })
    .await
  }

  async fn query_count(&self, sql: &str) -> anyhow::Result<usize> {
    let path = self.path.clone();
    let sql = sql.to_string();
    crate::dialect::run_blocking(move || {
      let conn = rusqlite::Connection::open(&path)?;
      let total = conn.query_row(&sql, [], |row| row.get::<_, i64>(0))? as usize;
      Ok(total)
    })
    .await
  }

  fn dialect(&self) -> &'static str {
    "sqlite"
  }

  async fn show_schema(&self, _schema: &str) -> anyhow::Result<RawArrowData> {
    let sql = "
      SELECT * FROM sqlite_master
      WHERE type IN ('table', 'view') and name NOT IN ('sqlite_sequence', 'sqlite_stat1')
      ";
    self.query(sql, 0, 0).await
  }

  async fn show_column(&self, _schema: Option<&str>, table: &str) -> anyhow::Result<RawArrowData> {
    let sql = format!("select * from pragma_table_info('{table}')");
    self.query(&sql, 0, 0).await
  }

  async fn all_columns(&self) -> anyhow::Result<Vec<Metadata>> {
    let path = self.path.clone();
    crate::dialect::run_blocking(move || {
      let conn = SqliteConnection { path };
      conn._all_columns()
    })
    .await
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let path = self.path.clone();
    let table = table.to_string();
    let where_ = r#where.to_string();
    crate::dialect::run_blocking(move || {
      let this = SqliteConnection { path };
      let conn = this.connect()?;
      let sql = this._table_count_sql(&table, &where_);
      let total = conn.query_row(&sql, [], |row| row.get::<_, i64>(0))? as usize;
      Ok(total)
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
    let mut chars = id.chars();
    let first = chars.next().unwrap();
    if !(first.is_ascii_alphabetic() || first == '_') {
      return false;
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
  }
}

impl SqliteConnection {
  fn connect(&self) -> anyhow::Result<rusqlite::Connection> {
    Ok(rusqlite::Connection::open(&self.path)?)
  }

  fn _query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    let conn = self.connect()?;
    let mut stmt = conn.prepare(sql)?;
    let batch = db_result_to_arrow(&mut stmt)?;
    let (titles, _schema) = Self::get_arrow_schema(&mut stmt);

    Ok(RawArrowData {
      total: batch.num_rows(),
      batch,
      titles: Some(titles),
      sql: Some(sql.to_string()),
    })
  }
  fn _all_columns(&self) -> anyhow::Result<Vec<Metadata>> {
    let table_names = self._all_table_names()?;
    let conn = self.connect()?;

    let mut metadata = Vec::new();
    for table_name in table_names {
      let sql = format!("select name, type from pragma_table_info('{table_name}')");
      let mut stmt = conn.prepare(&sql)?;
      let rows = stmt.query_map([], |row| {
        Ok((
          row.get::<_, String>(0)?, // column_name
          row.get::<_, String>(1)?, // column_type
        ))
      })?;

      let columns = rows.flatten().collect();
      metadata.push(Metadata {
        database: String::new(),
        table: table_name.clone(),
        columns,
      });
    }
    Ok(metadata)
  }

  fn _all_table_names(&self) -> anyhow::Result<Vec<String>> {
    let sql = "
      SELECT name FROM sqlite_master
      WHERE type IN ('table', 'view') and name NOT IN ('sqlite_sequence', 'sqlite_stat1')
      ";
    let conn = self.connect()?;
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    let mut table_names: Vec<String> = Vec::new();
    for name_result in rows {
      table_names.push(name_result?);
    }
    Ok(table_names)
  }
  fn get_arrow_schema(stmt: &mut Statement) -> (Vec<Title>, Arc<Schema>) {
    let mut fields = vec![];
    let mut titles = vec![];
    for col in stmt.columns() {
      titles.push(Title {
        name: col.name().to_string(),
        r#type: col.decl_type().unwrap_or_default().to_string(),
      });
      let typ = db_to_arrow_type(col.decl_type());
      let field = Field::new(col.name(), typ, true);
      fields.push(field);
    }

    let schema = Schema::new(fields);
    (titles, Arc::new(schema))
  }

  fn get_tables(&self) -> anyhow::Result<Vec<Table>> {
    let conn = self.connect()?;
    let sql = "
      SELECT tbl_name, name, type
      FROM sqlite_master
      WHERE type IN ('table', 'view') and name NOT IN ('sqlite_sequence', 'sqlite_stat1')";
    let mut stmt = conn.prepare(sql)?;
    let mut rows = stmt.query([])?;
    let mut tables: Vec<Table> = Vec::new();
    while let Some(row) = rows.next()? {
      tables.push(Table {
        table_name: row.get(1)?,
        table_type: row.get(2)?,
        db_name: String::new(),
        r#type: row.get(2)?,
        schema: None,
        size: None,
      });
    }
    Ok(tables)
  }
}

#[cfg(test)]
mod contract_tests {
  use super::*;
  use crate::dialect::Caps;

  fn temp_db() -> (SqliteConnection, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!("duckling_sqlite_{}.db", nanoid::nanoid!(8)));
    let conn = rusqlite::Connection::open(&path).unwrap();
    conn
      .execute(
        "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, score REAL)",
        [],
      )
      .unwrap();
    conn
      .execute(
        "INSERT INTO items (id, name, score) VALUES (1, 'a', 1.5), (2, 'b', 2.5)",
        [],
      )
      .unwrap();
    drop(conn);
    (
      SqliteConnection {
        path: path.to_string_lossy().to_string(),
      },
      path,
    )
  }

  #[tokio::test]
  async fn query_select_and_types() {
    let (db, path) = temp_db();
    let res = db
      .query("SELECT id, name, score FROM items ORDER BY id", 0, 0)
      .await
      .unwrap();
    assert_eq!(res.batch.num_rows(), 2);
    assert_eq!(res.batch.num_columns(), 3);
    assert!(db.capabilities().contains(Caps::QUERY));
    assert!(db.capabilities().contains(Caps::METADATA));
    let _ = std::fs::remove_file(path);
  }

  #[tokio::test]
  async fn paging_and_count() {
    let (db, path) = temp_db();
    let page = db
      .paging_query("SELECT id, name FROM items ORDER BY id", Some(1), Some(0))
      .await
      .unwrap();
    assert_eq!(page.batch.num_rows(), 1);
    assert_eq!(page.total, 2);

    let count = db
      .query_count("SELECT count(*) FROM items")
      .await
      .unwrap();
    assert_eq!(count, 2);
    let _ = std::fs::remove_file(path);
  }

  #[tokio::test]
  async fn schema_tree_and_columns() {
    let (db, path) = temp_db();
    let tree = db.get_db().await.unwrap();
    assert_eq!(tree.node_type, "root");
    let children = tree.children.unwrap_or_default();
    assert!(!children.is_empty());

    let cols = db.show_column(None, "items").await.unwrap();
    assert!(cols.batch.num_rows() >= 3);

    let meta = db.all_columns().await.unwrap();
    assert!(meta.iter().any(|m| m.table == "items"));
    let _ = std::fs::remove_file(path);
  }

  #[tokio::test]
  async fn table_row_count_with_where() {
    let (db, path) = temp_db();
    let n = db.table_row_count("items", "id = 1").await.unwrap();
    assert_eq!(n, 1);
    let _ = std::fs::remove_file(path);
  }
}

#[tokio::test]
#[ignore = "requires a local sqlite file"]
async fn test_tables() {
  use arrow::util::pretty::print_batches;
  let d = SqliteConnection {
    path: String::from(r""),
  };
  let res = d.query("", 0, 0).await.unwrap();
  let _ = print_batches(&[res.batch]);
}
