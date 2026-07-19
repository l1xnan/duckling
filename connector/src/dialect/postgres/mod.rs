mod type_arrow;
#[allow(dead_code)]
mod type_json;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use arrow::datatypes::ArrowNativeType;
use async_trait::async_trait;
use futures_util::FutureExt;
use tokio_postgres::{Client, NoTls};

use crate::dialect::Connection;
use crate::ssh_tunnel::{DbSshConfig, SshTunnel};
use crate::utils::{RawArrowData, Table, TreeNode, build_tree};
use anyhow::{Context, anyhow};

struct PostgresLive {
  _tunnel: Option<SshTunnel>,
  tunnel_port: Option<u16>,
  clients: HashMap<String, Arc<Client>>,
}

/// Postgres dialect connection. Tunnel + clients are cached per database name
/// and shared across clones for SessionManager reuse.
pub struct PostgresConnection {
  pub host: String,
  pub port: String,
  pub username: String,
  pub password: String,
  pub database: Option<String>,
  pub ssh: Option<DbSshConfig>,
  live: Arc<Mutex<Option<PostgresLive>>>,
}

impl Default for PostgresConnection {
  fn default() -> Self {
    Self::new(
      String::new(),
      String::new(),
      String::new(),
      String::new(),
      None,
      None,
    )
  }
}

impl PostgresConnection {
  pub fn new(
    host: String,
    port: String,
    username: String,
    password: String,
    database: Option<String>,
    ssh: Option<DbSshConfig>,
  ) -> Self {
    Self {
      host,
      port,
      username,
      password,
      database,
      ssh,
      live: Arc::new(Mutex::new(None)),
    }
  }
}

impl Clone for PostgresConnection {
  fn clone(&self) -> Self {
    Self {
      host: self.host.clone(),
      port: self.port.clone(),
      username: self.username.clone(),
      password: self.password.clone(),
      database: self.database.clone(),
      ssh: self.ssh.clone(),
      live: Arc::clone(&self.live),
    }
  }
}

impl std::fmt::Debug for PostgresConnection {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    f.debug_struct("PostgresConnection")
      .field("host", &self.host)
      .field("port", &self.port)
      .field("username", &self.username)
      .field("database", &self.database)
      .finish_non_exhaustive()
  }
}

#[async_trait]
impl Connection for PostgresConnection {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let tables = self.get_all_tables().await?;
    Ok(TreeNode {
      name: self.host.clone(),
      path: self.host.clone(),
      node_type: "root".to_string(),
      schema: None,
      children: Some(build_tree(tables)),
      size: None,
      comment: None,
    })
  }
  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<RawArrowData> {
    self._query(sql, limit, offset).await
  }

  fn dialect(&self) -> &'static str {
    "postgres"
  }

  async fn query_count(&self, sql: &str) -> anyhow::Result<usize> {
    self.query_count_cancellable(sql, None).await
  }

  async fn show_schema(&self, schema: &str) -> anyhow::Result<RawArrowData> {
    let sql = format!(
      "
    select * from information_schema.tables
    where table_schema='{schema}'
    order by table_type, table_name
    "
    );

    self.query(&sql, 0, 0).await
  }

  async fn show_column(&self, schema: Option<&str>, table: &str) -> anyhow::Result<RawArrowData> {
    let (_db, tbl) = if schema.is_none() && table.contains('.') {
      let parts: Vec<&str> = table.splitn(2, '.').collect();
      (parts[0], parts[1])
    } else {
      ("", table)
    };
    let sql = format!("select * from information_schema.columns where table_name='{tbl}'");
    log::info!("show columns: {}", &sql);
    self.query(&sql, 0, 0).await
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    self._table_row_count(table, r#where).await
  }

  async fn export(
    &self,
    sql: &str,
    file: &str,
    format: &str,
    options: &crate::utils::ExportOptions,
    cancel: Option<&crate::cancel::CancelToken>,
  ) -> anyhow::Result<()> {
    // Batched LIMIT/OFFSET export to bound peak memory for large result sets.
    self.export_batched(sql, file, format, options, cancel).await
  }

  fn start_quote(&self) -> &'static str {
    "\""
  }

  fn end_quote(&self) -> &'static str {
    "\""
  }
}

impl PostgresConnection {
  fn build_conn_string(&self, db: &str, tunnel_port: Option<u16>) -> String {
    let (host, port) = if let Some(local_port) = tunnel_port {
      ("127.0.0.1".to_string(), local_port.to_string())
    } else {
      (self.host.clone(), self.port.clone())
    };

    let mut config = format!(
      "host={host} port={port} user={} password={}",
      self.username, self.password
    );
    if !db.is_empty() {
      config.push_str(&format!(" dbname={db}"));
    }
    config
  }

  async fn ensure_tunnel(&self) -> anyhow::Result<Option<u16>> {
    {
      let guard = self
        .live
        .lock()
        .map_err(|_| anyhow!("postgres live lock poisoned"))?;
      if let Some(live) = guard.as_ref() {
        return Ok(live.tunnel_port);
      }
    }

    let tunnel = if let Some(ssh_config) = self.ssh.as_ref().and_then(|s| s.to_tunnel_config()) {
      let target_port = self.port.parse().context("invalid Postgres port")?;
      Some(SshTunnel::open(&ssh_config, &self.host, target_port)?)
    } else {
      None
    };
    let tunnel_port = tunnel.as_ref().map(|t| t.local_port());

    let mut guard = self
      .live
      .lock()
      .map_err(|_| anyhow!("postgres live lock poisoned"))?;
    if guard.is_none() {
      *guard = Some(PostgresLive {
        _tunnel: tunnel,
        tunnel_port,
        clients: HashMap::new(),
      });
    }
    Ok(guard.as_ref().and_then(|l| l.tunnel_port))
  }

  async fn get_client(&self, db: &str) -> anyhow::Result<Arc<Client>> {
    let tunnel_port = self.ensure_tunnel().await?;
    let db_key = if db.is_empty() {
      "postgres".to_string()
    } else {
      db.to_string()
    };

    {
      let guard = self
        .live
        .lock()
        .map_err(|_| anyhow!("postgres live lock poisoned"))?;
      if let Some(live) = guard.as_ref()
        && let Some(client) = live.clients.get(&db_key)
      {
        return Ok(Arc::clone(client));
      }
    }

    let config = self.build_conn_string(&db_key, tunnel_port);
    let client = Arc::new(connect(&config).await?);

    let mut guard = self
      .live
      .lock()
      .map_err(|_| anyhow!("postgres live lock poisoned"))?;
    let live = guard
      .as_mut()
      .ok_or_else(|| anyhow!("postgres live missing after ensure_tunnel"))?;
    Ok(Arc::clone(
      live
        .clients
        .entry(db_key)
        .or_insert_with(|| Arc::clone(&client)),
    ))
  }

  pub async fn databases(&self) -> anyhow::Result<Vec<String>> {
    let client = self.get_client("postgres").await?;
    let sql = "SELECT datname FROM pg_database WHERE datistemplate = false";

    let mut names = vec![];
    for row in client.query(sql, &[]).await? {
      names.push(row.get(0));
    }
    Ok(names)
  }

  pub async fn get_tables(&self, db: &str) -> anyhow::Result<Vec<Table>> {
    let client = self.get_client(db).await?;

    let sql = "
      select
        table_catalog as db_name,
        table_schema as table_schema,
        table_name as table_name,
        table_type as table_type,
        CASE WHEN table_type='BASE TABLE' THEN 'table' ELSE 'view' END as type
      from information_schema.tables WHERE table_schema='public'
      ";
    let mut tables = vec![];
    for row in client.query(sql, &[]).await? {
      tables.push(Table {
        db_name: row.get::<_, String>(0),
        schema: Some(row.get::<_, String>(1)),
        table_name: row.get::<_, String>(2),
        table_type: row.get::<_, String>(3),
        r#type: row.get::<_, String>(4),
        size: None,
      });
    }
    Ok(tables)
  }

  pub async fn get_all_tables(&self) -> anyhow::Result<Vec<Table>> {
    let names = self.databases().await?;
    let mut tables = vec![];

    for db in names {
      tables.extend(self.get_tables(&db).await?);
    }
    Ok(tables)
  }

  async fn _query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    self.query_cancellable(sql, None).await
  }

  /// Run COUNT with optional cooperative cancellation.
  pub async fn query_count_cancellable(
    &self,
    sql: &str,
    cancel: Option<&crate::cancel::CancelToken>,
  ) -> anyhow::Result<usize> {
    let client = self.get_client(&self.database()).await?;
    let row = crate::cancel::with_cancel(cancel, async {
      client
        .query_one(sql, &[])
        .await
        .map_err(|e| anyhow::anyhow!(e))
    })
    .await?;
    let total: u32 = row.get(0);
    Ok(total as usize)
  }

  /// Run a query with optional cooperative cancellation (select races cancel token).
  pub async fn query_cancellable(
    &self,
    sql: &str,
    cancel: Option<&crate::cancel::CancelToken>,
  ) -> anyhow::Result<RawArrowData> {
    if let Some(t) = cancel {
      t.check()?;
    }
    let client = self.get_client(&self.database()).await?;
    if let Some(t) = cancel {
      t.check()?;
    }

    let stmt = crate::cancel::with_cancel(cancel, async {
      client.prepare(sql).await.map_err(|e| anyhow::anyhow!(e))
    })
    .await?;

    let rows = crate::cancel::with_cancel(cancel, async {
      client
        .query(&stmt, &[])
        .await
        .map_err(|e| anyhow::anyhow!(e))
    })
    .await?;

    if let Some(t) = cancel {
      t.check()?;
    }
    let (titles, batch) = type_arrow::rows_to_arrow(stmt.columns(), &rows)?;

    Ok(RawArrowData {
      total: batch.num_rows(),
      batch,
      titles: Some(titles),
      sql: Some(sql.to_string()),
    })
  }

  fn database(&self) -> String {
    self.database.clone().unwrap_or("postgres".to_string())
  }

  async fn _table_row_count(&self, table: &str, cond: &str) -> anyhow::Result<usize> {
    let client = self.get_client(&self.database()).await?;
    let sql = self._table_count_sql(table, cond);
    let row = client.query_one(&sql, &[]).await?;
    let total: u32 = row.get::<_, u32>(0);
    Ok(total.as_usize())
  }
}

async fn connect(s: &str) -> anyhow::Result<Client> {
  let (client, connection) = tokio_postgres::connect(s, NoTls).await?;
  let connection = connection.map(|e| e.unwrap());
  tokio::spawn(connection);
  Ok(client)
}

#[tokio::test]
async fn test_database() {}

#[tokio::test]
async fn query_cancellable_respects_precheck() {
  use crate::cancel::CancelToken;
  let conn = PostgresConnection::new(
    "127.0.0.1".into(),
    "1".into(),
    "u".into(),
    "p".into(),
    None,
    None,
  );
  let token = CancelToken::new();
  token.cancel();
  let err = match conn.query_cancellable("select 1", Some(&token)).await {
    Ok(_) => panic!("expected cancelled error"),
    Err(e) => e,
  };
  assert!(
    err.to_string().contains("cancel"),
    "expected cancelled, got {err}"
  );
}
