use crate::dialect::ast::first_stmt;
use crate::utils::{Metadata, RawArrowData};
use crate::utils::{TreeNode, batch_write};
use async_trait::async_trait;
use itertools::Itertools;

pub mod ast;
pub mod capabilities;
pub mod clickhouse;
pub mod duckdb;
pub mod file;
pub mod folder;
pub mod mysql;
pub mod postgres;
pub mod quack;
pub mod sqlite;

pub use capabilities::{Caps, caps_for_dialect};

/// Run a synchronous connector operation off the async runtime.
pub async fn run_blocking<T, F>(f: F) -> anyhow::Result<T>
where
  T: Send + 'static,
  F: FnOnce() -> anyhow::Result<T> + Send + 'static,
{
  tokio::task::spawn_blocking(f)
    .await
    .map_err(|e| anyhow::anyhow!("blocking task join error: {e}"))?
}

fn unsupported(method: &'static str) -> anyhow::Error {
  anyhow::Error::new(crate::error::ConnectorError::unsupported(method))
}

#[async_trait]
pub trait Connection: Sync + Send {
  /// Operations this connection supports (for UI gating / IPC).
  fn capabilities(&self) -> Caps {
    caps_for_dialect(self.dialect())
  }

  async fn get_db(&self) -> anyhow::Result<TreeNode>;
  
  /// List available database/schema names (lightweight, no table/column metadata).
  async fn list_databases(&self) -> anyhow::Result<Vec<String>> {
    Err(unsupported("list_databases"))
  }
  
  async fn query(&self, _sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    Err(unsupported("query"))
  }

  async fn query_count(&self, _sql: &str) -> anyhow::Result<usize> {
    Err(unsupported("query_count"))
  }
  async fn query_all(&self, _sql: &str) -> anyhow::Result<RawArrowData> {
    Err(unsupported("query_all"))
  }

  fn dialect(&self) -> &'static str {
    "generic"
  }

  async fn paging_query(
    &self,
    sql: &str,
    limit: Option<usize>,
    offset: Option<usize>,
  ) -> anyhow::Result<RawArrowData> {
    let dialect = self.dialect();
    let stmt = first_stmt(dialect, sql);

    let limit_sql = if let Some(ref _stmt) = stmt {
      ast::limit_stmt(dialect, _stmt, limit, offset).unwrap_or(sql.to_string())
    } else {
      sql.to_string()
    };
    let mut res = self.query(&limit_sql, 0, 0).await?;

    // get total row count
    if let Some(ref _stmt) = stmt
      && let Some(count_sql) = ast::count_stmt(dialect, _stmt)
    {
      log::info!("count_sql: {count_sql}");
      if let Ok(count) = self.query_count(&count_sql).await {
        res.total = count;
      };
    }
    res.sql = Some(sql.to_string());
    Ok(res)
  }

  async fn _sql_row_count(&self, _sql: &str) -> anyhow::Result<usize> {
    Err(unsupported("_sql_row_count"))
  }

  async fn query_table(
    &self,
    table: &str,
    limit: usize,
    offset: usize,
    where_: &str,
    order_by: &str,
  ) -> anyhow::Result<RawArrowData> {
    let sql = self._table_query_sql(table, where_, order_by);
    let mut limit_sql = self._table_query_sql(table, where_, order_by);

    if limit != 0 {
      limit_sql = format!("{limit_sql} limit {limit}");
    }
    if offset != 0 {
      limit_sql = format!("{limit_sql} offset {offset}");
    }
    log::warn!(
      "query table {}, sql: {}, limit_sql: {}",
      &table,
      &sql,
      &limit_sql
    );
    let res = self.query(&limit_sql, 0, 0).await;

    let total = self
      .table_row_count(table, where_)
      .await
      .unwrap_or_default();

    res.map(|r| RawArrowData {
      total,
      sql: Some(sql),
      ..r
    })
  }

  async fn show_schema(&self, _schema: &str) -> anyhow::Result<RawArrowData> {
    Err(unsupported("show_schema"))
  }

  async fn show_column(&self, _schema: Option<&str>, _table: &str) -> anyhow::Result<RawArrowData> {
    Err(unsupported("show_column"))
  }

  async fn all_columns(&self) -> anyhow::Result<Vec<Metadata>> {
    Ok(vec![])
  }

  async fn drop_table(&self, _schema: Option<&str>, _table: &str) -> anyhow::Result<String> {
    Err(unsupported("drop_table"))
  }

  async fn table_row_count(&self, _table: &str, _where: &str) -> anyhow::Result<usize> {
    Err(unsupported("table_row_count"))
  }

  fn _table_count_sql(&self, table: &str, where_: &str) -> String {
    let table = self.quote_table_ref(table);
    let mut sql = format!("select count(*) as num from {table}");
    if !where_.trim().is_empty() {
      sql = format!("{sql} where {where_}");
    }
    sql
  }

  fn normalize(&self, name: &str) -> String {
    self.quote(name)
  }

  /// Quote a possibly-qualified table reference (`schema.table`).
  fn quote_table_ref(&self, table: &str) -> String {
    table
      .split('.')
      .map(|item| self.quote(item))
      .join(".")
  }

  fn _table_query_sql(&self, table: &str, where_: &str, order_by: &str) -> String {
    let table = self.quote_table_ref(table);
    let mut sql = format!("select * from {table}");
    if !where_.trim().is_empty() {
      sql = format!("{sql} where {where_}");
    }
    if !order_by.trim().is_empty() {
      sql = format!("{sql} order by {order_by}");
    }
    sql
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
    if crate::utils::format_supports_streaming(format) {
      self.export_batched(sql, file, format, options, cancel).await
    } else {
      if let Some(t) = cancel {
        t.check()?;
      }
      let batch = self.query(sql, 0, 0).await?.batch;
      if let Some(t) = cancel {
        t.check()?;
      }
      batch_write(file, &batch, format, options)?;
      Ok(())
    }
  }

  /// Export by paging through the result with LIMIT/OFFSET to bound peak memory.
  async fn export_batched(
    &self,
    sql: &str,
    file: &str,
    format: &str,
    options: &crate::utils::ExportOptions,
    cancel: Option<&crate::cancel::CancelToken>,
  ) -> anyhow::Result<()> {
    use crate::utils::{EXPORT_BATCH_ROWS, StreamExporter};

    let dialect = self.dialect();
    let stmt = first_stmt(dialect, sql);
    let mut exporter = StreamExporter::create(file, format, options)?;
    let mut offset = 0usize;
    let page = EXPORT_BATCH_ROWS;

    loop {
      if let Some(t) = cancel {
        t.check()?;
      }
      let page_sql = if let Some(ref s) = stmt {
        ast::limit_stmt(dialect, s, Some(page), Some(offset)).unwrap_or_else(|| {
          format!("select * from ({sql}) ____ limit {page} offset {offset}")
        })
      } else {
        // Unparsed SQL: wrap as subquery (works for most engines).
        format!("select * from ({sql}) ____ export_page limit {page} offset {offset}")
      };

      let batch = self.query(&page_sql, 0, 0).await?.batch;
      let n = batch.num_rows();
      if n == 0 {
        break;
      }
      exporter.write_batch(&batch)?;
      if n < page {
        break;
      }
      offset = offset.saturating_add(page);
    }

    exporter.finish()?;
    Ok(())
  }

  async fn find(&self, _value: &str, _path: &str) -> anyhow::Result<RawArrowData> {
    Err(unsupported("find"))
  }
  async fn execute(&self, _sql: &str) -> anyhow::Result<usize> {
    Err(unsupported("execute"))
  }

  /// check if the identifier is valid
  fn validator(&self, _id: &str) -> bool {
    true
  }
  fn start_quote(&self) -> &'static str {
    "`"
  }
  fn end_quote(&self) -> &'static str {
    "`"
  }
  fn quote(&self, identifier: &str) -> String {
    let start_quote = self.start_quote();
    let end_quote = self.end_quote();
    // 1. 检查是否已经正确引用
    if identifier.starts_with(start_quote) && identifier.ends_with(end_quote) {
      return identifier.to_string();
    }

    // 2. 使用配置的验证器判断是否需要引用
    if self.validator(identifier) {
      return identifier.to_string();
    }

    // 3. 执行引用和转义
    // 转义规则：将标识符中的 "结束引用符" 替换为两个 "结束引用符"
    // 例如： my"table -> "my""table"  或  my]table -> [my]]table]
    let escaped = identifier.replace(end_quote, &format!("{}{}", end_quote, end_quote));

    // 4. 用开始和结束引用符包裹
    format!("{}{}{}", start_quote, escaped, end_quote)
  }
}
