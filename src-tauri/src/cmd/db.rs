use std::sync::Arc;
use std::time::Instant;

use serde::Deserialize;
use serde::Serialize;
use tauri::State;

use crate::api::ArrowResponse;
use super::connection_registry::{self, ConnectionRegistry};
use super::inflight::{InflightGuard, InflightQueries};
use super::session_manager::SessionManager;
use connector::ConnectionConfig;
use connector::dialect::Connection;
use connector::utils::{Metadata, TreeNode};

#[allow(dead_code)]
pub(crate) fn build_ssh_config(
  ssh_enabled: Option<bool>,
  ssh_host: Option<String>,
  ssh_port: Option<String>,
  ssh_username: Option<String>,
  ssh_password: Option<String>,
  ssh_private_key_path: Option<String>,
  ssh_passphrase: Option<String>,
) -> Option<connector::ssh_tunnel::DbSshConfig> {
  build_ssh_config_ex(
    ssh_enabled,
    ssh_host,
    ssh_port,
    ssh_username,
    ssh_password,
    ssh_private_key_path,
    ssh_passphrase,
    None,
  )
}

#[allow(clippy::too_many_arguments)]
#[allow(dead_code)]
pub(crate) fn build_ssh_config_ex(
  ssh_enabled: Option<bool>,
  ssh_host: Option<String>,
  ssh_port: Option<String>,
  ssh_username: Option<String>,
  ssh_password: Option<String>,
  ssh_private_key_path: Option<String>,
  ssh_passphrase: Option<String>,
  ssh_host_key_policy: Option<String>,
) -> Option<connector::ssh_tunnel::DbSshConfig> {
  ConnectionConfig::default()
    .with_ssh_ex(
      ssh_enabled,
      ssh_host,
      ssh_port,
      ssh_username,
      ssh_password,
      ssh_private_key_path,
      ssh_passphrase,
      ssh_host_key_policy,
    )
    .ssh
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct DialectPayload {
  /// When set, credentials are loaded from the in-memory connection registry.
  /// Accept both camelCase (JS) and snake_case.
  #[serde(default, alias = "connectionId")]
  pub connection_id: Option<String>,
  #[serde(default)]
  pub dialect: String,
  pub path: Option<String>,
  pub username: Option<String>,
  pub password: Option<String>,
  pub host: Option<String>,
  pub port: Option<String>,
  pub database: Option<String>,
  pub cwd: Option<String>,
  pub uri: Option<String>,
  pub token: Option<String>,
  /// Frontend DialectConfig uses snake_case (`disable_ssl`); also accept camelCase.
  #[serde(default, alias = "disableSsl")]
  pub disable_ssl: Option<bool>,
  /// Postgres TLS: `disable` | `require`
  #[serde(default, alias = "sslMode")]
  pub ssl_mode: Option<String>,
  #[serde(default, alias = "sshEnabled")]
  pub ssh_enabled: Option<bool>,
  #[serde(default, alias = "sshHost")]
  pub ssh_host: Option<String>,
  #[serde(default, alias = "sshPort")]
  pub ssh_port: Option<String>,
  #[serde(default, alias = "sshUsername")]
  pub ssh_username: Option<String>,
  #[serde(default, alias = "sshPassword")]
  pub ssh_password: Option<String>,
  #[serde(default, alias = "sshPrivateKeyPath")]
  pub ssh_private_key_path: Option<String>,
  #[serde(default, alias = "sshPassphrase")]
  pub ssh_passphrase: Option<String>,
  /// `insecure` | `accept_new` | `strict`
  #[serde(default, alias = "sshHostKeyPolicy")]
  pub ssh_host_key_policy: Option<String>,
}

#[allow(dead_code)]
pub fn get_ast_dialect(dialect: &str) -> Box<dyn sqlparser::dialect::Dialect> {
  connector::dialect::ast::convert_dialect(dialect)
}

async fn resolve_connection(
  registry: &ConnectionRegistry,
  sessions: &SessionManager,
  dialect: DialectPayload,
) -> Result<Arc<dyn Connection>, String> {
  let resolved = connection_registry::resolve_payload(registry, dialect)?;
  if let Some(id) = resolved
    .connection_id
    .as_ref()
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty())
  {
    let payload = resolved.clone();
    return sessions.get_or_insert(&id, &payload, || {
      block_create(payload.clone())
    });
  }
  block_create(resolved).map(Arc::from)
}

fn payload_to_config(payload: DialectPayload) -> ConnectionConfig {
  ConnectionConfig {
    dialect: payload.dialect,
    path: payload.path,
    username: payload.username,
    password: payload.password,
    host: payload.host,
    port: payload.port,
    database: payload.database,
    cwd: payload.cwd,
    uri: payload.uri,
    token: payload.token,
    disable_ssl: payload.disable_ssl,
    ssl_mode: payload.ssl_mode,
    ssh: None,
  }
  .with_ssh_ex(
    payload.ssh_enabled,
    payload.ssh_host,
    payload.ssh_port,
    payload.ssh_username,
    payload.ssh_password,
    payload.ssh_private_key_path,
    payload.ssh_passphrase,
    payload.ssh_host_key_policy,
  )
}

fn block_create(payload: DialectPayload) -> Result<Box<dyn Connection>, String> {
  connector::open(payload_to_config(payload)).map_err(|e| e.to_string())
}

/// Build a connector from a fully-resolved payload (secrets already merged).
#[allow(dead_code)]
pub async fn get_dialect_from_payload(payload: DialectPayload) -> Option<Box<dyn Connection>> {
  block_create(payload).ok()
}

#[derive(Debug, Clone, Serialize)]
pub struct CapabilitiesResponse {
  pub dialect: String,
  pub capabilities: Vec<&'static str>,
}

/// Return capability flags for a connection (or dialect-only payload).
#[tauri::command]
pub async fn connection_capabilities(
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  dialect: DialectPayload,
) -> Result<CapabilitiesResponse, String> {
  // Prefer live connection when registered; otherwise dialect name table.
  if dialect
    .connection_id
    .as_ref()
    .map(|s| !s.trim().is_empty())
    .unwrap_or(false)
  {
    let d = resolve_connection(&registry, &sessions, dialect).await?;
    return Ok(CapabilitiesResponse {
      dialect: d.dialect().to_string(),
      capabilities: d.capabilities().names(),
    });
  }
  let name = dialect.dialect.clone();
  let caps = connector::dialect::caps_for_dialect(&name);
  Ok(CapabilitiesResponse {
    dialect: name,
    capabilities: caps.names(),
  })
}

/// Cancel an in-flight query by `request_id` previously passed to query/paging_query.
#[tauri::command]
pub async fn cancel_query(
  inflight: State<'_, InflightQueries>,
  request_id: String,
) -> Result<bool, String> {
  inflight.cancel(&request_id)
}

/// Update global session idle TTL. `secs == 0` disables automatic eviction.
#[tauri::command]
pub async fn set_session_idle_ttl(
  sessions: State<'_, SessionManager>,
  secs: u64,
) -> Result<u64, String> {
  sessions.set_idle_ttl_secs(secs);
  Ok(sessions.idle_ttl_secs())
}

/// Current global session idle TTL in seconds (`0` = disabled).
#[tauri::command]
pub async fn get_session_idle_ttl(
  sessions: State<'_, SessionManager>,
) -> Result<u64, String> {
  Ok(sessions.idle_ttl_secs())
}

#[tauri::command]
pub async fn query(
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  inflight: State<'_, InflightQueries>,
  sql: String,
  limit: usize,
  offset: usize,
  dialect: DialectPayload,
  #[allow(non_snake_case)]
  requestId: Option<String>,
) -> Result<ArrowResponse, String> {
  let d = resolve_connection(&registry, &sessions, dialect).await?;
  let start = Instant::now();
  let res = if let Some(ref rid) = requestId.filter(|s| !s.trim().is_empty()) {
    let (_guard, token) = InflightGuard::register(&inflight, rid)?;
    // Race the dialect query against cancel (cooperative; best-effort for sync drivers).
    connector::cancel::with_cancel(Some(&token), d.query(&sql, limit, offset)).await
  } else {
    d.query(&sql, limit, offset).await
  };
  let duration = start.elapsed().as_millis();
  Ok(ArrowResponse::from_raw_data(
    res,
    Some(duration),
    Some(sql),
  ))
}

#[tauri::command]
pub async fn paging_query(
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  inflight: State<'_, InflightQueries>,
  sql: String,
  limit: usize,
  offset: usize,
  dialect: DialectPayload,
  #[allow(non_snake_case)]
  requestId: Option<String>,
) -> Result<ArrowResponse, String> {
  let d = resolve_connection(&registry, &sessions, dialect).await?;
  let start = Instant::now();
  let res = if let Some(ref rid) = requestId.filter(|s| !s.trim().is_empty()) {
    let (_guard, token) = InflightGuard::register(&inflight, rid)?;
    connector::cancel::with_cancel(
      Some(&token),
      d.paging_query(&sql, Some(limit), Some(offset)),
    )
    .await
  } else {
    d.paging_query(&sql, Some(limit), Some(offset)).await
  };
  let duration = start.elapsed().as_millis();
  Ok(ArrowResponse::from_raw_data(
    res,
    Some(duration),
    Some(sql),
  ))
}

#[tauri::command]
pub async fn query_table(
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  inflight: State<'_, InflightQueries>,
  table: &str,
  limit: usize,
  offset: usize,
  #[allow(non_snake_case)] orderBy: Option<String>,
  r#where: Option<String>,
  dialect: DialectPayload,
  #[allow(non_snake_case)]
  requestId: Option<String>,
) -> Result<ArrowResponse, String> {
  let d = resolve_connection(&registry, &sessions, dialect).await?;
  let where_s = r#where.unwrap_or_default();
  let order_s = orderBy.unwrap_or_default();

  let start = Instant::now();
  let res = if let Some(ref rid) = requestId.filter(|s| !s.trim().is_empty()) {
    let (_guard, token) = InflightGuard::register(&inflight, rid)?;
    connector::cancel::with_cancel(
      Some(&token),
      d.query_table(table, limit, offset, &where_s, &order_s),
    )
    .await
  } else {
    d.query_table(table, limit, offset, &where_s, &order_s)
      .await
  };
  let duration = start.elapsed().as_millis();
  // Prefer backend-built SQL on success; on failure still surface a browse-style SQL.
  let fallback_sql = {
    let mut s = format!("select * from {table}");
    if !where_s.is_empty() {
      s = format!("{s} where {where_s}");
    }
    if !order_s.is_empty() {
      s = format!("{s} order by {order_s}");
    }
    Some(s)
  };
  Ok(ArrowResponse::from_raw_data(
    res,
    Some(duration),
    fallback_sql,
  ))
}

#[tauri::command]
pub async fn table_row_count(
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  table: &str,
  condition: &str,
  dialect: DialectPayload,
) -> Result<usize, String> {
  let d = resolve_connection(&registry, &sessions, dialect).await?;
  d.table_row_count(table, condition)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export(
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  inflight: State<'_, InflightQueries>,
  sql: String,
  file: String,
  format: Option<String>,
  options: Option<connector::utils::ExportOptions>,
  dialect: DialectPayload,
  #[allow(non_snake_case)]
  requestId: Option<String>,
) -> Result<(), String> {
  let d = resolve_connection(&registry, &sessions, dialect).await?;
  let format = if let Some(format) = format {
    format
  } else {
    file.split('.').next_back().unwrap_or("csv").to_string()
  };
  let options = options.unwrap_or_default();
  if let Some(ref rid) = requestId.filter(|s| !s.trim().is_empty()) {
    let (_guard, token) = InflightGuard::register(&inflight, rid)?;
    d.export(&sql, &file, &format, &options, Some(&token))
      .await
      .map_err(|e| e.to_string())?;
  } else {
    d.export(&sql, &file, &format, &options, None)
      .await
      .map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[tauri::command]
pub async fn find(
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  value: &str,
  path: &str,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  let d = resolve_connection(&registry, &sessions, dialect).await?;
  let res = d.find(value, path).await;
  Ok(ArrowResponse::from_raw_data(res, None, None))
}

#[tauri::command]
pub async fn get_db(
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  dialect: DialectPayload,
) -> Result<TreeNode, String> {
  let d = resolve_connection(&registry, &sessions, dialect).await?;
  d.get_db().await.map_err(|e| e.to_string())
}

/// Lightweight: list database/schema names only (no tables or columns).
#[tauri::command]
pub async fn list_databases(
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  dialect: DialectPayload,
) -> Result<Vec<String>, String> {
  let d = resolve_connection(&registry, &sessions, dialect).await?;
  d.list_databases().await.map_err(|e| e.to_string())
}

/// Lightweight connectivity check (no full schema load for SQL network dialects).
#[tauri::command]
pub async fn test_connection(
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  dialect: DialectPayload,
) -> Result<(), String> {
  let dialect_name = dialect.dialect.clone();
  let d = resolve_connection(&registry, &sessions, dialect).await?;
  match dialect_name.as_str() {
    // Path-based: opening the path / listing is enough.
    "folder" | "file" | "duckdb" | "sqlite" => d
      .get_db()
      .await
      .map(|_| ())
      .map_err(|e| e.to_string()),
    // Network / SQL: SELECT 1 without pulling schema tree.
    _ => d
      .query("SELECT 1", 1, 0)
      .await
      .map(|_| ())
      .map_err(|e| e.to_string()),
  }
}

#[tauri::command]
pub async fn show_schema(
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  schema: &str,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  let d = resolve_connection(&registry, &sessions, dialect).await?;
  let res = d.show_schema(schema).await;
  Ok(ArrowResponse::from_raw_data(res, None, None))
}

#[tauri::command]
pub async fn show_column(
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  schema: Option<&str>,
  table: &str,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  let d = resolve_connection(&registry, &sessions, dialect).await?;
  let res = d.show_column(schema, table).await;
  Ok(ArrowResponse::from_raw_data(res, None, None))
}

#[tauri::command]
pub async fn drop_table(
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  schema: Option<&str>,
  table: &str,
  dialect: DialectPayload,
) -> Result<String, String> {
  let d = resolve_connection(&registry, &sessions, dialect).await?;
  d.drop_table(schema, table)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn all_columns(
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  dialect: DialectPayload,
) -> Result<Vec<Metadata>, String> {
  let d = resolve_connection(&registry, &sessions, dialect).await?;
  let s = d.all_columns().await;
  s.map_err(|e| format!("not support dialect {}", e))
}

#[cfg(test)]
mod tests {
  use super::*;
  use super::connection_registry::ConnectionRegistry;

  fn block_on<F: std::future::Future>(f: F) -> F::Output {
    use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};
    fn dummy(_: *const ()) {}
    fn clone(_: *const ()) -> RawWaker {
      RawWaker::new(std::ptr::null(), &VTABLE)
    }
    static VTABLE: RawWakerVTable = RawWakerVTable::new(clone, dummy, dummy, dummy);
    let waker = unsafe { Waker::from_raw(RawWaker::new(std::ptr::null(), &VTABLE)) };
    let mut cx = Context::from_waker(&waker);
    let mut fut = Box::pin(f);
    loop {
      if let Poll::Ready(v) = fut.as_mut().poll(&mut cx) {
        return v;
      }
    }
  }

  #[test]
  fn get_ast_dialect_matches_known_names() {
    let _ = get_ast_dialect("mysql");
    let _ = get_ast_dialect("postgres");
    let _ = get_ast_dialect("duckdb");
    let _ = get_ast_dialect("folder");
    let _ = get_ast_dialect("file");
    let _ = get_ast_dialect("quack");
    let _ = get_ast_dialect("clickhouse");
    let _ = get_ast_dialect("unknown-dialect");
  }

  #[test]
  fn build_ssh_config_disabled_returns_none() {
    assert!(
      build_ssh_config(
        Some(false),
        Some("h".into()),
        Some("22".into()),
        Some("u".into()),
        None,
        None,
        None,
      )
      .is_none()
    );
    assert!(
      build_ssh_config(None, Some("h".into()), None, None, None, None, None).is_none()
    );
  }

  #[test]
  fn build_ssh_config_enabled_defaults_port_22() {
    let cfg = build_ssh_config(
      Some(true),
      Some("bastion".into()),
      None,
      Some("deploy".into()),
      Some("pw".into()),
      Some("/key".into()),
      Some("ph".into()),
    )
    .expect("ssh config");
    assert!(cfg.enabled);
    assert_eq!(cfg.host, "bastion");
    assert_eq!(cfg.port, "22");
    assert_eq!(cfg.username, "deploy");
    assert_eq!(cfg.password.as_deref(), Some("pw"));
    assert_eq!(cfg.private_key_path.as_deref(), Some("/key"));
    assert_eq!(cfg.passphrase.as_deref(), Some("ph"));
  }

  #[test]
  fn dialect_payload_accepts_connection_id_aliases() {
    let camel = r#"{"connectionId":"abc","dialect":"mysql","host":"h","port":"3306"}"#;
    let p: DialectPayload = serde_json::from_str(camel).unwrap();
    assert_eq!(p.connection_id.as_deref(), Some("abc"));
    assert_eq!(p.dialect, "mysql");
    assert_eq!(p.host.as_deref(), Some("h"));

    let snake = r#"{"connection_id":"xyz","dialect":"mysql"}"#;
    let p2: DialectPayload = serde_json::from_str(snake).unwrap();
    assert_eq!(p2.connection_id.as_deref(), Some("xyz"));
  }

  #[test]
  fn dialect_payload_accepts_snake_case_ssh_fields_from_frontend() {
    let json = r#"{
      "connectionId": "c1",
      "dialect": "mysql",
      "host": "10.0.0.5",
      "port": "3306",
      "username": "root",
      "password": "db-pw",
      "ssh_enabled": true,
      "ssh_host": "bastion",
      "ssh_port": "22",
      "ssh_username": "deploy",
      "ssh_password": "ssh-pw",
      "ssh_private_key_path": "/home/u/.ssh/id_rsa",
      "ssh_passphrase": "ph"
    }"#;
    let p: DialectPayload = serde_json::from_str(json).unwrap();
    assert_eq!(p.connection_id.as_deref(), Some("c1"));
    assert_eq!(p.password.as_deref(), Some("db-pw"));
    assert_eq!(p.ssh_enabled, Some(true));
    assert_eq!(p.ssh_host.as_deref(), Some("bastion"));
    assert_eq!(p.ssh_port.as_deref(), Some("22"));
    assert_eq!(p.ssh_username.as_deref(), Some("deploy"));
    assert_eq!(p.ssh_password.as_deref(), Some("ssh-pw"));
    assert_eq!(
      p.ssh_private_key_path.as_deref(),
      Some("/home/u/.ssh/id_rsa")
    );
    assert_eq!(p.ssh_passphrase.as_deref(), Some("ph"));

    let ssh = build_ssh_config(
      p.ssh_enabled,
      p.ssh_host.clone(),
      p.ssh_port.clone(),
      p.ssh_username.clone(),
      p.ssh_password.clone(),
      p.ssh_private_key_path.clone(),
      p.ssh_passphrase.clone(),
    )
    .expect("ssh should be enabled");
    assert_eq!(ssh.host, "bastion");
    assert_eq!(ssh.password.as_deref(), Some("ssh-pw"));
  }

  #[test]
  fn get_dialect_from_payload_rejects_unknown() {
    let payload = DialectPayload {
      dialect: "not-a-db".into(),
      ..Default::default()
    };
    assert!(block_on(get_dialect_from_payload(payload)).is_none());
  }

  #[test]
  fn get_dialect_from_payload_builds_file_and_sqlite() {
    let file = DialectPayload {
      dialect: "file".into(),
      path: Some("/tmp/a.parquet".into()),
      ..Default::default()
    };
    assert!(block_on(get_dialect_from_payload(file)).is_some());

    let sqlite = DialectPayload {
      dialect: "sqlite".into(),
      path: Some("/tmp/a.db".into()),
      ..Default::default()
    };
    assert!(block_on(get_dialect_from_payload(sqlite)).is_some());
  }

  #[test]
  fn get_dialect_from_payload_builds_network_dialects() {
    for dialect in ["mysql", "postgres", "clickhouse"] {
      let payload = DialectPayload {
        dialect: dialect.into(),
        host: Some("127.0.0.1".into()),
        port: Some(if dialect == "postgres" {
          "5432".into()
        } else if dialect == "clickhouse" {
          "8123".into()
        } else {
          "3306".into()
        }),
        username: Some("u".into()),
        password: Some("p".into()),
        database: Some("d".into()),
        ..Default::default()
      };
      assert!(
        block_on(get_dialect_from_payload(payload)).is_some(),
        "failed for {dialect}"
      );
    }

    let quack = DialectPayload {
      dialect: "quack".into(),
      uri: Some("quack:localhost".into()),
      token: Some("t".into()),
      disable_ssl: Some(true),
      ..Default::default()
    };
    assert!(block_on(get_dialect_from_payload(quack)).is_some());
  }

  #[test]
  fn resolve_connection_uses_registry() {
    let registry = ConnectionRegistry::default();
    let sessions = SessionManager::default();
    {
      let mut map = registry.0.lock().unwrap();
      map.insert(
        "c1".into(),
        DialectPayload {
          connection_id: Some("c1".into()),
          dialect: "sqlite".into(),
          path: Some("/tmp/x.db".into()),
          password: Some("unused-for-sqlite".into()),
          ..Default::default()
        },
      );
    }
    let req = DialectPayload {
      connection_id: Some("c1".into()),
      ..Default::default()
    };
    let conn = block_on(resolve_connection(&registry, &sessions, req));
    assert!(conn.is_ok());
    assert_eq!(sessions.len(), 1);
  }

  #[test]
  fn resolve_connection_missing_id_errors() {
    let registry = ConnectionRegistry::default();
    let sessions = SessionManager::default();
    let req = DialectPayload {
      connection_id: Some("nope".into()),
      ..Default::default()
    };
    let err = match block_on(resolve_connection(&registry, &sessions, req)) {
      Ok(_) => panic!("expected missing connection error"),
      Err(e) => e,
    };
    assert!(err.contains("not registered"));
  }

  #[test]
  fn resolve_connection_reuses_session() {
    let registry = ConnectionRegistry::default();
    let sessions = SessionManager::default();
    {
      let mut map = registry.0.lock().unwrap();
      map.insert(
        "c1".into(),
        DialectPayload {
          connection_id: Some("c1".into()),
          dialect: "file".into(),
          path: Some("/tmp/a.csv".into()),
          ..Default::default()
        },
      );
    }
    let req = DialectPayload {
      connection_id: Some("c1".into()),
      ..Default::default()
    };
    let a = block_on(resolve_connection(&registry, &sessions, req.clone())).unwrap();
    let b = block_on(resolve_connection(&registry, &sessions, req)).unwrap();
    assert!(std::sync::Arc::ptr_eq(&a, &b));
    assert_eq!(sessions.len(), 1);
  }

  #[test]
  fn connection_capabilities_from_live_session() {
    let registry = ConnectionRegistry::default();
    let sessions = SessionManager::default();
    {
      let mut map = registry.0.lock().unwrap();
      map.insert(
        "c1".into(),
        DialectPayload {
          connection_id: Some("c1".into()),
          dialect: "folder".into(),
          path: Some("/tmp/data".into()),
          ..Default::default()
        },
      );
    }
    let conn = block_on(resolve_connection(
      &registry,
      &sessions,
      DialectPayload {
        connection_id: Some("c1".into()),
        ..Default::default()
      },
    ))
    .unwrap();
    let names = conn.capabilities().names();
    assert!(names.contains(&"query"));
    assert!(names.contains(&"find"));
    assert!(names.contains(&"drop_table"));
    assert_eq!(conn.dialect(), "folder");
  }

  #[test]
  fn dialect_only_capabilities_table() {
    let caps = connector::dialect::caps_for_dialect("mysql");
    assert!(caps.names().contains(&"export"));
    assert!(!caps.names().contains(&"find"));
  }
}
