use crate::dialect::Connection;
use crate::dialect::duckdb::duckdb_sync::DuckDbSyncConnection;
use crate::utils::{Metadata, RawArrowData, Table, TreeNode, build_tree};
use async_trait::async_trait;
use regex::Regex;
use std::sync::OnceLock;

#[derive(Debug, Default, Clone)]
pub struct QuackConnection {
  pub uri: String,
  pub token: Option<String>,
  pub disable_ssl: bool,
}

fn fn_call_re() -> &'static Regex {
  static RE: OnceLock<Regex> = OnceLock::new();
  RE.get_or_init(|| Regex::new(r"^[a-zA-Z_][a-zA-Z0-9_]*\([^)]*\)$").unwrap())
}

#[async_trait]
impl Connection for QuackConnection {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let this = self.clone();
    crate::dialect::run_blocking(move || {
      let conn = this.connect()?;
      let tables = this.get_tables(&conn)?;
      Ok(TreeNode {
        name: this.uri.clone(),
        path: this.uri.clone(),
        node_type: "root".to_string(),
        schema: None,
        children: Some(build_tree(tables)),
        size: None,
        comment: None,
      })
    })
    .await
  }

  async fn list_databases(&self) -> anyhow::Result<Vec<String>> {
    let this = self.clone();
    crate::dialect::run_blocking(move || {
      let conn = this.connect()?;
      this.databases(&conn)
    })
    .await
  }

  async fn query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    let this = self.clone();
    let sql = sql.to_string();
    crate::dialect::run_blocking(move || {
      let conn = this.connect()?;
      let wrapped = this.wrap_sql(&sql);
      let (titles, batch) = conn.query(&wrapped)?;
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
      let conn = this.connect()?;
      let wrapped = this.wrap_sql(&sql);
      let total = conn
        .inner
        .query_row(&wrapped, [], |row| row.get::<_, usize>(0))?;
      Ok(total)
    })
    .await
  }

  fn dialect(&self) -> &'static str {
    "quack"
  }

  async fn show_schema(&self, schema: &str) -> anyhow::Result<RawArrowData> {
    let sql = format!(
      "SELECT * FROM information_schema.tables WHERE table_schema='{schema}' ORDER BY table_type, table_name"
    );
    self.query(&sql, 0, 0).await
  }

  async fn show_column(&self, schema: Option<&str>, table: &str) -> anyhow::Result<RawArrowData> {
    let (db, tbl) = if schema.is_none() && table.contains('.') {
      let parts: Vec<&str> = table.splitn(2, '.').collect();
      (parts[0], parts[1])
    } else {
      (schema.unwrap_or(""), table)
    };
    let sql = format!(
      "SELECT * FROM information_schema.columns WHERE table_schema='{db}' AND table_name='{tbl}'"
    );
    log::info!("show columns: {}", &sql);
    self.query(&sql, 0, 0).await
  }

  async fn all_columns(&self) -> anyhow::Result<Vec<Metadata>> {
    let this = self.clone();
    crate::dialect::run_blocking(move || {
      let conn = this.connect()?;
      this.fetch_all_columns(&conn)
    })
    .await
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let sql = self._table_count_sql(table, r#where);
    self.query_count(&sql).await
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
    crate::dialect::run_blocking(move || {
      let conn = this.connect()?;
      let wrapped = this.wrap_sql(&sql);
      conn.export(&wrapped, &file, &format, &options)
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

    if id.starts_with('\'') && id.ends_with('\'') {
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

impl QuackConnection {
  pub(crate) fn connect(&self) -> anyhow::Result<DuckDbSyncConnection> {
    let conn = DuckDbSyncConnection::new(None, None)?;
    conn.inner.execute("INSTALL quack; LOAD quack;", duckdb::params![])?;
    Ok(conn)
  }

  pub(crate) fn wrap_sql(&self, query: &str) -> String {
    let uri = escape_sql_string(&self.uri);
    let query_quoted = dollar_quote(query);
    let mut args = vec![format!("'{uri}'"), query_quoted];

    if let Some(token) = &self.token {
      if !token.is_empty() {
        args.push(format!(
          "token => '{}'",
          escape_sql_string(token)
        ));
      }
    }

    args.push(format!("disable_ssl => {}", self.disable_ssl));

    format!("SELECT * FROM quack_query({})", args.join(", "))
  }

  fn get_tables(&self, conn: &DuckDbSyncConnection) -> anyhow::Result<Vec<Table>> {
    let sql = "
      SELECT table_catalog, table_schema, table_name, table_type
      FROM information_schema.tables
      ORDER BY table_type, table_name
    ";
    let wrapped = self.wrap_sql(sql);
    let mut stmt = conn.inner.prepare(&wrapped)?;
    let tables = stmt
      .query_map([], |row| {
        let table_type: String = row.get(3)?;
        Ok(Table {
          db_name: row.get(0)?,
          schema: row.get(1)?,
          table_name: row.get(2)?,
          table_type: table_type.clone(),
          r#type: if table_type == "VIEW" {
            "view".to_string()
          } else {
            "table".to_string()
          },
          size: None,
        })
      })?
        .flatten()
        .collect();
    Ok(tables)
  }

  fn databases(&self, conn: &DuckDbSyncConnection) -> anyhow::Result<Vec<String>> {
    let sql = "
      SELECT DISTINCT table_catalog
      FROM information_schema.tables
      ORDER BY table_catalog
    ";
    let wrapped = self.wrap_sql(sql);
    let mut stmt = conn.inner.prepare(&wrapped)?;
    let names = stmt
      .query_map([], |row| row.get(0))?
      .flatten()
      .collect();
    Ok(names)
  }

  fn fetch_all_columns(&self, conn: &DuckDbSyncConnection) -> anyhow::Result<Vec<Metadata>> {
    use std::collections::HashMap;

    let sql = "
      SELECT table_catalog, table_schema, table_name, column_name, data_type
      FROM information_schema.columns
      GROUP BY ALL
    ";
    let wrapped = self.wrap_sql(sql);
    let mut stmt = conn.inner.prepare(&wrapped)?;
    let rows = stmt.query_map([], |row| {
      Ok((
        row.get::<_, String>(0)?,
        row.get::<_, String>(2)?,
        row.get::<_, String>(3)?,
        row.get::<_, String>(4)?,
      ))
    })?;

    let mut table_map: HashMap<(String, String), Vec<(String, String)>> = HashMap::new();
    for row in rows {
      let (db, table, column, r#type) = row?;
      table_map
        .entry((db.clone(), table.clone()))
        .or_default()
        .push((column, r#type));
    }

    Ok(table_map
      .into_iter()
      .map(|((database, table), columns)| Metadata {
        database,
        table,
        columns,
      })
      .collect())
  }
}

fn escape_sql_string(value: &str) -> String {
  value.replace('\'', "''")
}

fn dollar_quote(value: &str) -> String {
  let mut tag = String::new();
  loop {
    let delimiter = format!("${tag}$");
    if !value.contains(&delimiter) {
      return format!("{delimiter}{value}{delimiter}");
    }
    tag.push('_');
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_wrap_sql() {
    let conn = QuackConnection {
      uri: "quack:remote.com".to_string(),
      token: Some("MY_QUACK_TOKEN_01234567890ABCDEF".to_string()),
      disable_ssl: true,
    };
    let wrapped = conn.wrap_sql("SELECT 42");
    assert_eq!(
      wrapped,
      "SELECT * FROM quack_query('quack:remote.com', $$SELECT 42$$, token => 'MY_QUACK_TOKEN_01234567890ABCDEF', disable_ssl => true)"
    );
  }

  #[test]
  fn test_wrap_sql_without_token() {
    let conn = QuackConnection {
      uri: "quack:localhost".to_string(),
      token: None,
      disable_ssl: false,
    };
    let wrapped = conn.wrap_sql("SELECT 1");
    assert_eq!(
      wrapped,
      "SELECT * FROM quack_query('quack:localhost', $$SELECT 1$$, disable_ssl => false)"
    );
  }
}
