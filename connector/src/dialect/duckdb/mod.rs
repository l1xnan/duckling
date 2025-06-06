use crate::utils::{Metadata, RawArrowData};
use crate::dialect::Connection;
use crate::dialect::duckdb::duckdb_sync::DuckDbSyncConnection;
use crate::utils::{TreeNode, write_csv};
use async_trait::async_trait;
use std::collections::HashMap;

pub mod duckdb_sync;

#[derive(Debug, Default)]
pub struct DuckDbConnection {
  pub path: String,
  pub cwd: Option<String>,
}

#[async_trait]
impl Connection for DuckDbConnection {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    Ok(self.connect()?.get_db()?)
  }

  async fn query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    let (titles, batch) = self.connect()?.query(sql)?;
    let total = batch.num_rows();
    Ok(RawArrowData {
      total,
      batch,
      titles: Some(titles),
      sql: Some(sql.to_string()),
    })
  }

  #[allow(clippy::unused_async)]
  async fn query_count(&self, sql: &str) -> anyhow::Result<usize> {
    let total = self
      .connect()?
      .inner
      .query_row(sql, [], |row| row.get::<_, usize>(0))?;
    Ok(total)
  }

  fn dialect(&self) -> &'static str {
    "duckdb"
  }

  async fn show_schema(&self, schema: &str) -> anyhow::Result<RawArrowData> {
    let batch = self.connect()?.show_schema(schema)?;
    Ok(RawArrowData::from_batch(batch))
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

  async fn all_columns(&self) -> anyhow::Result<Vec<Metadata>> {
    Ok(self.connect()?.all_columns()?)
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
    self.connect()?.drop_table(&table_name)?;
    Ok(String::new())
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let conn = self.connect()?;
    let sql = self._table_count_sql(table, r#where);
    let total = conn
      .inner
      .query_row(&sql, [], |row| row.get::<_, usize>(0))?;
    Ok(total)
  }

  fn normalize(&self, name: &str) -> String {
    if name.contains(' ') {
      format!("\"{name}\"")
    } else {
      name.to_string()
    }
  }

  async fn export(&self, sql: &str, file: &str) -> anyhow::Result<()> {
    let batch = self.connect()?.query_arrow(sql)?;
    write_csv(file, &batch)?;
    Ok(())
  }

  fn validator(&self, id: &str) -> bool {
    if id.is_empty() { return false; }
    let mut chars = id.chars();
    let first = chars.next().unwrap();
    if !(first.is_ascii_alphabetic() || first == '_') { return false; }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
  }
}

impl DuckDbConnection {
  pub(crate) fn connect(&self) -> anyhow::Result<DuckDbSyncConnection> {
    Ok(DuckDbSyncConnection::new(
      Some(self.path.clone()),
      self.cwd.clone(),
    )?)
  }
}

#[tokio::test]
async fn test_duckdb() {
  use arrow::util::pretty::print_batches;
  let _ = print_batches(&[]);
}
