use crate::dialect::ast::first_stmt;
use crate::utils::{Metadata, RawArrowData};
use crate::utils::{TreeNode, batch_write};
use async_trait::async_trait;
use itertools::Itertools;

pub mod ast;
pub mod clickhouse;
pub mod clickhouse_tcp;
pub mod duckdb;
pub mod file;
pub mod folder;
pub mod mysql;
pub mod postgres;
pub mod sqlite;

#[async_trait]
pub trait Connection: Sync + Send {
  async fn get_db(&self) -> anyhow::Result<TreeNode>;
  async fn query(&self, _sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    unimplemented!()
  }

  async fn query_count(&self, _sql: &str) -> anyhow::Result<usize> {
    unimplemented!()
  }
  async fn query_all(&self, _sql: &str) -> anyhow::Result<RawArrowData> {
    unimplemented!()
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
    let mut sql = sql.to_string();

    let dialect = self.dialect();
    let stmt = first_stmt(dialect, &sql);

    if let Some(ref _stmt) = stmt {
      sql = ast::limit_stmt(dialect, _stmt, limit, offset).unwrap_or(sql);
    }
    let mut res = self.query(&sql, 0, 0).await?;

    // get total row count
    if let Some(ref _stmt) = stmt
      && let Some(count_sql) = ast::count_stmt(dialect, _stmt)
    {
      log::info!("count_sql: {count_sql}");
      if let Ok(count) = self.query_count(&count_sql).await {
        res.total = count;
      };
    }
    Ok(res)
  }

  async fn _sql_row_count(&self, _sql: &str) -> anyhow::Result<usize> {
    unimplemented!()
  }

  async fn query_table(
    &self,
    table: &str,
    limit: usize,
    offset: usize,
    where_: &str,
    order_by: &str,
  ) -> anyhow::Result<RawArrowData> {
    let mut sql = self._table_query_sql(table, where_, order_by);

    if limit != 0 {
      sql = format!("{sql} limit {limit}");
    }
    if offset != 0 {
      sql = format!("{sql} offset {offset}");
    }
    println!("query table {}: {}", table, sql);
    let res = self.query(&sql, 0, 0).await;

    let total = self
      .table_row_count(table, where_)
      .await
      .unwrap_or_default();

    res.map(|r| RawArrowData { total, ..r })
  }

  async fn show_schema(&self, _schema: &str) -> anyhow::Result<RawArrowData> {
    unimplemented!()
  }

  async fn show_column(&self, _schema: Option<&str>, _table: &str) -> anyhow::Result<RawArrowData> {
    unimplemented!()
  }

  async fn all_columns(&self) -> anyhow::Result<Vec<Metadata>> {
    Ok(vec![])
  }

  async fn drop_table(&self, _schema: Option<&str>, _table: &str) -> anyhow::Result<String> {
    unimplemented!()
  }

  async fn table_row_count(&self, _table: &str, _where: &str) -> anyhow::Result<usize> {
    unimplemented!()
  }

  fn _table_count_sql(&self, table: &str, where_: &str) -> String {
    let mut sql = format!("select count(*) as num from {table}");
    if !where_.trim().is_empty() {
      sql = format!("{sql} where {where_}");
    }
    sql
  }

  fn normalize(&self, name: &str) -> String {
    if name.contains(' ') {
      format!("`{name}`")
    } else {
      name.to_string()
    }
  }

  fn _table_query_sql(&self, table: &str, where_: &str, order_by: &str) -> String {
    let table = table
      .split(".")
      .into_iter()
      .map(|item| self.quote(item))
      .join(".");
    let mut sql = format!("select * from {table}");
    if !where_.trim().is_empty() {
      sql = format!("{sql} where {where_}");
    }
    if !order_by.trim().is_empty() {
      sql = format!("{sql} order by {order_by}");
    }
    sql
  }

  async fn export(&self, sql: &str, file: &str, format: &str) -> anyhow::Result<()> {
    let batch = self.query(sql, 0, 0).await?.batch;
    batch_write(&file, &batch, format)?;
    Ok(())
  }

  async fn find(&self, value: &str, path: &str) -> anyhow::Result<RawArrowData> {
    unimplemented!()
  }
  async fn execute(&self, sql: &str) -> anyhow::Result<usize> {
    unimplemented!()
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
