mod type_arrow;

use crate::dialect::Connection;
use crate::ssh_tunnel::{DbSshConfig, SshTunnel};
use crate::utils::{Metadata, RawArrowData, Table, build_tree};
use crate::utils::{Title, TreeNode};
use anyhow::{Context, anyhow};
use arrow::array::*;
use arrow::datatypes::Schema;
use async_trait::async_trait;
use mysql::prelude::*;
use mysql::*;
use std::collections::HashMap;
use std::fmt::Debug;
use std::sync::{Arc, Mutex};
use type_arrow::*;

pub type MySqlSshConfig = DbSshConfig;

struct MySqlLive {
  _tunnel: Option<SshTunnel>,
  pool: Pool,
}

/// MySQL dialect connection. Pool + SSH tunnel are cached on first use and
/// shared across clones so SessionManager can reuse one live session.
pub struct MySqlConnection {
  pub host: String,
  pub port: String,
  pub username: String,
  pub password: String,
  pub database: Option<String>,
  pub ssh: Option<DbSshConfig>,
  live: Arc<Mutex<Option<MySqlLive>>>,
}

impl Default for MySqlConnection {
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

impl MySqlConnection {
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

impl std::fmt::Debug for MySqlConnection {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    f.debug_struct("MySqlConnection")
      .field("host", &self.host)
      .field("port", &self.port)
      .field("username", &self.username)
      .field("database", &self.database)
      .finish_non_exhaustive()
  }
}

impl Clone for MySqlConnection {
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

impl std::fmt::Debug for MySqlLive {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    f.debug_struct("MySqlLive").finish_non_exhaustive()
  }
}

#[async_trait]
impl Connection for MySqlConnection {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let this = self.clone_config();
    let tables = crate::dialect::run_blocking(move || this.get_tables()).await?;
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

  async fn query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    let this = self.clone_config();
    let sql = sql.to_string();
    crate::dialect::run_blocking(move || this._query(&sql)).await
  }

  async fn query_count(&self, sql: &str) -> anyhow::Result<usize> {
    let this = self.clone_config();
    let sql = sql.to_string();
    crate::dialect::run_blocking(move || {
      let mut conn = this.get_conn()?;
      if let Some(total) = conn.query_first::<usize, _>(sql)? {
        Ok(total)
      } else {
        Err(anyhow::anyhow!("null"))
      }
    })
    .await
  }

  async fn query_all(&self, sql: &str) -> anyhow::Result<RawArrowData> {
    self.query(sql, 0, 0).await
  }

  async fn show_schema(&self, schema: &str) -> anyhow::Result<RawArrowData> {
    let sql = format!(
      "select * from information_schema.tables where TABLE_SCHEMA='{schema}' order by TABLE_TYPE, TABLE_NAME"
    );
    self.query(&sql, 0, 0).await
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
    let this = self.clone_config();
    crate::dialect::run_blocking(move || this._all_columns()).await
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let this = self.clone_config();
    let table = table.to_string();
    let where_ = r#where.to_string();
    crate::dialect::run_blocking(move || this._table_row_count(&table, &where_)).await
  }

  fn start_quote(&self) -> &'static str {
    "`"
  }

  fn end_quote(&self) -> &'static str {
    "`"
  }

  fn validator(&self, id: &str) -> bool {
    // MySQL 规则: 字母, 数字, _, $; 不以数字开头
    if id.is_empty() {
      return false;
    }
    let mut chars = id.chars();
    let first = chars.next().unwrap(); // is_empty check ensures this is safe
    if first.is_ascii_digit() {
      return false;
    }
    if !(first.is_ascii_alphabetic() || first == '_' || first == '$') {
      return false;
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$')
  }
}

impl MySqlConnection {
  fn clone_config(&self) -> Self {
    self.clone()
  }

  fn get_opts(&self, tunnel: Option<&SshTunnel>) -> anyhow::Result<Opts> {
    let mut builder = OptsBuilder::new()
      .user(Some(self.username.clone()))
      .pass(Some(self.password.clone()))
      .db_name(self.database.clone())
      .prefer_socket(false);

    if let Some(tunnel) = tunnel {
      builder = builder
        .ip_or_hostname(Some("127.0.0.1"))
        .tcp_port(tunnel.local_port());
    } else {
      builder = builder
        .ip_or_hostname(Some(self.host.clone()))
        .tcp_port(self.port.parse().unwrap_or(3306));
    }

    Ok(builder.into())
  }

  fn ensure_live(&self) -> anyhow::Result<()> {
    let mut guard = self
      .live
      .lock()
      .map_err(|_| anyhow!("mysql live lock poisoned"))?;
    if guard.is_some() {
      return Ok(());
    }

    let tunnel = if let Some(ssh_config) = self.ssh.as_ref().and_then(|s| s.to_tunnel_config()) {
      let target_port = self.port.parse().context("invalid MySQL port")?;
      Some(SshTunnel::open(&ssh_config, &self.host, target_port)?)
    } else {
      None
    };

    let opts = self.get_opts(tunnel.as_ref())?;
    let pool = Pool::new(opts)?;
    *guard = Some(MySqlLive {
      _tunnel: tunnel,
      pool,
    });
    Ok(())
  }

  fn get_conn(&self) -> anyhow::Result<PooledConn> {
    self.ensure_live()?;
    let guard = self
      .live
      .lock()
      .map_err(|_| anyhow!("mysql live lock poisoned"))?;
    let live = guard
      .as_ref()
      .ok_or_else(|| anyhow!("mysql live pool missing"))?;
    Ok(live.pool.get_conn()?)
  }

  pub fn get_tables(&self) -> anyhow::Result<Vec<Table>> {
    let mut conn = self.get_conn()?;

    let sql = r"
    select
      TABLE_SCHEMA as table_schema,
      TABLE_NAME as table_name,
      TABLE_TYPE as table_type,
      if(TABLE_TYPE='BASE TABLE', 'table', 'view') as type,
      CAST(round(((data_length + IFNULL(index_length, 0)) / 1024 / 1024)) AS UNSIGNED)  AS size
    from information_schema.tables
    ";
    let tables = conn.query_map(
      sql,
      |(table_schema, table_name, table_type, r#type, size)| Table {
        db_name: table_schema,
        table_name,
        table_type,
        r#type,
        size: Some(size),
        schema: None,
      },
    )?;
    Ok(tables)
  }

  fn _all_columns(&self) -> anyhow::Result<Vec<Metadata>> {
    let mut conn = self.get_conn()?;
    let sql = "
    SELECT
        table_schema,
        table_name,
        column_name,
        column_type
    FROM information_schema.columns
    -- WHERE table_schema NOT IN ('mysql', 'performance_schema', 'information_schema', 'sys') -- 排除系统库
    ORDER BY table_schema, table_name, ordinal_position;
    ";

    let rows: Vec<(String, String, String, String)> = conn.query(sql)?;

    // 使用 HashMap 按数据库和表名分组列信息
    let mut groups: HashMap<(String, String), Vec<(String, String)>> = HashMap::new();
    for (db, table, col, dtype) in rows {
      groups
        .entry((db, table))
        .or_insert_with(Vec::new)
        .push((col, dtype));
    }
    // 转换为最终结构
    let metadata_list: Vec<Metadata> = groups
      .into_iter()
      .map(|((database, table), columns)| Metadata {
        database,
        table,
        columns,
      })
      .collect();

    Ok(metadata_list)
  }

  fn _query(&self, sql: &str) -> anyhow::Result<RawArrowData> {
    let mut conn = self.get_conn()?;

    let mut result = conn.query_iter(sql)?;
    let columns = result.columns();
    let columns = columns.as_ref();
    let k = columns.len();

    let (fields, types) = get_fields(columns);
    let titles = self.get_titles(columns);
    let mut tables: Vec<Vec<Value>> = (0..k).map(|_| vec![]).collect();
    while let Some(result_set) = result.iter() {
      for row in result_set.flatten() {
        for (i, _col) in row.columns_ref().iter().enumerate() {
          let val = row.get::<Value, _>(i).unwrap();
          tables[i].push(val);
        }
      }
    }

    let arrs = convert_arrow(types, tables);

    let schema = Schema::new(fields);
    let batch = RecordBatch::try_new(Arc::new(schema), arrs)?;
    Ok(RawArrowData {
      total: batch.num_rows(),
      batch,
      titles: Some(titles.clone()),
      sql: Some(sql.to_string()),
    })
  }

  fn get_titles(&self, columns: &[Column]) -> Vec<Title> {
    columns
      .iter()
      .map(|col| {
        let type_ = format!("{:?}", col.column_type());
        let type_ = type_.strip_prefix("MYSQL_TYPE_").unwrap_or(type_.as_str());
        Title {
          name: col.name_str().to_string(),
          r#type: type_.to_string(),
        }
      })
      .collect()
  }

  fn _table_row_count(&self, table: &str, cond: &str) -> anyhow::Result<usize> {
    let mut conn = self.get_conn()?;
    let mut sql = format!("select count(*) from {table}");
    if !cond.is_empty() {
      sql = format!("{sql} where {cond}");
    }
    conn
      .query_first::<usize, _>(&sql)?
      .ok_or_else(|| anyhow!("No value found"))
  }
}

#[tokio::test]
async fn test_query() {}
