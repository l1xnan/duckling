use crate::dialect::Connection;
use crate::dialect::duckdb::duckdb_sync::DuckDbSyncConnection;
use crate::utils::{Metadata, RawArrowData, TreeNode};
use async_trait::async_trait;
use regex::Regex;
use std::sync::OnceLock;

pub mod duckdb_sync;

#[derive(Debug, Default, Clone)]
pub struct DuckDbConnection {
  pub path: String,
  pub cwd: Option<String>,
}

fn fn_call_re() -> &'static Regex {
  static RE: OnceLock<Regex> = OnceLock::new();
  RE.get_or_init(|| Regex::new(r"^[a-zA-Z_][a-zA-Z0-9_]*\([^)]*\)$").unwrap())
}

#[async_trait]
impl Connection for DuckDbConnection {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let this = self.clone();
    crate::dialect::run_blocking(move || this.connect()?.get_db()).await
  }

  async fn list_databases(&self) -> anyhow::Result<Vec<String>> {
    let path = self.path.clone();
    let name = std::path::Path::new(&path)
      .file_stem()
      .map(|n| n.to_string_lossy().to_string())
      .unwrap_or_else(|| path.clone());
    Ok(vec![name])
  }

  async fn query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    let this = self.clone();
    let sql = sql.to_string();
    crate::dialect::run_blocking(move || {
      let (titles, batch) = this.connect()?.query(&sql)?;
      let total = batch.num_rows();
      Ok(RawArrowData {
        total,
        batch,
        titles: Some(titles),
        sql: Some(sql),
      })
    })
    .await
  }

  async fn query_count(&self, sql: &str) -> anyhow::Result<usize> {
    let this = self.clone();
    let sql = sql.to_string();
    crate::dialect::run_blocking(move || {
      let total = this
        .connect()?
        .inner
        .query_row(&sql, [], |row| row.get::<_, usize>(0))?;
      Ok(total)
    })
    .await
  }

  fn dialect(&self) -> &'static str {
    "duckdb"
  }

  async fn show_schema(&self, schema: &str) -> anyhow::Result<RawArrowData> {
    let this = self.clone();
    let schema = schema.to_string();
    crate::dialect::run_blocking(move || {
      let batch = this.connect()?.show_schema(&schema)?;
      Ok(RawArrowData::from_batch(batch))
    })
    .await
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
    let this = self.clone();
    crate::dialect::run_blocking(move || this.connect()?.all_columns()).await
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
    let this = self.clone();
    crate::dialect::run_blocking(move || {
      this.connect()?.drop_table(&table_name)?;
      Ok(String::new())
    })
    .await
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let this = self.clone();
    let sql = self._table_count_sql(table, r#where);
    crate::dialect::run_blocking(move || {
      let total = this
        .connect()?
        .inner
        .query_row(&sql, [], |row| row.get::<_, usize>(0))?;
      Ok(total)
    })
    .await
  }

  fn normalize(&self, name: &str) -> String {
    if name.contains(' ') {
      format!("\"{name}\"")
    } else {
      name.to_string()
    }
  }

  async fn export(
    &self,
    sql: &str,
    file: &str,
    format: &str,
    options: &crate::utils::ExportOptions,
    cancel: Option<&crate::cancel::CancelToken>,
  ) -> anyhow::Result<()> {
    if let Some(t) = cancel {
      t.check()?;
    }
    let this = self.clone();
    let sql = sql.to_string();
    let file = file.to_string();
    let format = format.to_string();
    let options = options.clone();
    // COPY is a single engine call; cooperative cancel is best-effort (pre-check only).
    crate::dialect::run_blocking(move || this.connect()?.export(&sql, &file, &format, &options))
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

    if id.starts_with("'") && id.ends_with("'") {
      return true;
    }

    if fn_call_re().is_match(id) {
      return true;
    }

    let mut chars = id.chars();
    let first = chars.next().unwrap();
    if !(first.is_ascii_alphabetic() || first == '_') {
      return false;
    }
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
#[ignore = "requires a local duckdb file"]
async fn test_duckdb() {
  use arrow::util::pretty::print_batches;
  let conn = DuckDbSyncConnection::new(
    Some("D:/data_obs/product_nice_l1/deepseek.db".to_string()),
    None,
  )
  .unwrap();
  let res = conn.query("SELECT extension_name, installed, description FROM duckdb_extensions()");
  let (_, batch) = res.unwrap();
  let _ = print_batches(&[batch]);
}
