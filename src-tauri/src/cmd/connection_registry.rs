use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use super::db::DialectPayload;
use super::secret_store::{self, ConnectionSecrets};
use super::session_manager::SessionManager;

/// In-memory connection configs (with secrets) for the app process lifetime.
#[derive(Default)]
pub struct ConnectionRegistry(pub Mutex<HashMap<String, DialectPayload>>);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterConnectionRequest {
  pub id: String,
  /// Non-secret profile fields (may include empty password placeholders).
  pub payload: DialectPayload,
  /// Optional secrets from the form (preferred over vault when non-empty).
  #[serde(default)]
  pub secrets: Option<ConnectionSecrets>,
}

fn merge_secrets_into_payload(
  mut payload: DialectPayload,
  secrets: &ConnectionSecrets,
) -> DialectPayload {
  if let Some(password) = secrets.password.clone().filter(|s| !s.is_empty()) {
    payload.password = Some(password);
  }
  if let Some(ssh_password) = secrets.ssh_password.clone().filter(|s| !s.is_empty()) {
    payload.ssh_password = Some(ssh_password);
  }
  if let Some(ssh_passphrase) = secrets
    .ssh_passphrase
    .clone()
    .filter(|s| !s.is_empty())
  {
    payload.ssh_passphrase = Some(ssh_passphrase);
  }
  if let Some(token) = secrets.token.clone().filter(|s| !s.is_empty()) {
    payload.token = Some(token);
  }
  payload
}

fn apply_overrides(base: DialectPayload, overlay: &DialectPayload) -> DialectPayload {
  DialectPayload {
    connection_id: base.connection_id.or_else(|| overlay.connection_id.clone()),
    dialect: if overlay.dialect.is_empty() {
      base.dialect
    } else {
      overlay.dialect.clone()
    },
    path: overlay.path.clone().or(base.path),
    username: overlay.username.clone().or(base.username),
    password: overlay.password.clone().or(base.password),
    host: overlay.host.clone().or(base.host),
    port: overlay.port.clone().or(base.port),
    database: overlay.database.clone().or(base.database),
    cwd: overlay.cwd.clone().or(base.cwd),
    uri: overlay.uri.clone().or(base.uri),
    token: overlay.token.clone().or(base.token),
    disable_ssl: overlay.disable_ssl.or(base.disable_ssl),
    ssh_enabled: overlay.ssh_enabled.or(base.ssh_enabled),
    ssh_host: overlay.ssh_host.clone().or(base.ssh_host),
    ssh_port: overlay.ssh_port.clone().or(base.ssh_port),
    ssh_username: overlay.ssh_username.clone().or(base.ssh_username),
    ssh_password: overlay.ssh_password.clone().or(base.ssh_password),
    ssh_private_key_path: overlay
      .ssh_private_key_path
      .clone()
      .or(base.ssh_private_key_path),
    ssh_passphrase: overlay.ssh_passphrase.clone().or(base.ssh_passphrase),
  }
}

/// Resolve a dialect payload: if `connection_id` is set, load from registry
/// (and optionally apply field overrides). Otherwise use the payload as-is.
pub fn resolve_payload(
  registry: &ConnectionRegistry,
  payload: DialectPayload,
) -> Result<DialectPayload, String> {
  let Some(id) = payload
    .connection_id
    .as_ref()
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty())
  else {
    return Ok(payload);
  };

  let map = registry
    .0
    .lock()
    .map_err(|_| "connection registry lock poisoned".to_string())?;
  let base = map
    .get(&id)
    .cloned()
    .ok_or_else(|| format!("connection not registered: {id}"))?;
  Ok(apply_overrides(base, &payload))
}

async fn register_one(
  app: &AppHandle,
  registry: &ConnectionRegistry,
  sessions: &SessionManager,
  request: RegisterConnectionRequest,
) -> Result<(), String> {
  let id = request.id.trim().to_string();
  if id.is_empty() {
    return Err("connection id is required".into());
  }

  let mut secrets = request.secrets.unwrap_or_default();
  if let Ok(Some(stored)) = secret_store::load_secrets(app, &id).await {
    if secrets.password.as_ref().map(|s| s.is_empty()).unwrap_or(true) {
      secrets.password = stored.password;
    }
    if secrets
      .ssh_password
      .as_ref()
      .map(|s| s.is_empty())
      .unwrap_or(true)
    {
      secrets.ssh_password = stored.ssh_password;
    }
    if secrets
      .ssh_passphrase
      .as_ref()
      .map(|s| s.is_empty())
      .unwrap_or(true)
    {
      secrets.ssh_passphrase = stored.ssh_passphrase;
    }
    if secrets.token.as_ref().map(|s| s.is_empty()).unwrap_or(true) {
      secrets.token = stored.token;
    }
  }

  if !secrets.is_empty() {
    secret_store::store_secrets(app, &id, &secrets).await?;
  }

  let mut payload = request.payload;
  payload.connection_id = Some(id.clone());
  payload = merge_secrets_into_payload(payload, &secrets);

  let mut map = registry
    .0
    .lock()
    .map_err(|_| "connection registry lock poisoned".to_string())?;
  map.insert(id.clone(), payload);
  // Config changed — drop any live session so next query reconnects.
  sessions.invalidate(&id);
  Ok(())
}

#[tauri::command]
pub async fn register_connection(
  app: AppHandle,
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  request: RegisterConnectionRequest,
) -> Result<(), String> {
  register_one(&app, &registry, &sessions, request).await
}

#[tauri::command]
pub async fn unregister_connection(
  app: AppHandle,
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  connection_id: String,
  #[allow(unused_variables)]
  delete_secrets: Option<bool>,
) -> Result<(), String> {
  let id = connection_id.trim().to_string();
  {
    let mut map = registry
      .0
      .lock()
      .map_err(|_| "connection registry lock poisoned".to_string())?;
    map.remove(&id);
  }
  sessions.invalidate(&id);
  if delete_secrets.unwrap_or(false) {
    let _ = secret_store::secret_delete(app, id).await;
  }
  Ok(())
}

#[tauri::command]
pub async fn sync_connections(
  app: AppHandle,
  registry: State<'_, ConnectionRegistry>,
  sessions: State<'_, SessionManager>,
  connections: Vec<RegisterConnectionRequest>,
) -> Result<(), String> {
  for request in connections {
    register_one(&app, &registry, &sessions, request).await?;
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  fn mysql_payload(password: &str) -> DialectPayload {
    DialectPayload {
      connection_id: Some("c1".into()),
      dialect: "mysql".into(),
      host: Some("127.0.0.1".into()),
      port: Some("3306".into()),
      username: Some("root".into()),
      password: Some(password.into()),
      database: Some("app".into()),
      ..Default::default()
    }
  }

  #[test]
  fn resolve_without_connection_id_is_passthrough() {
    let registry = ConnectionRegistry::default();
    let payload = DialectPayload {
      dialect: "file".into(),
      path: Some("/tmp/a.csv".into()),
      ..Default::default()
    };
    let resolved = resolve_payload(&registry, payload.clone()).unwrap();
    assert_eq!(resolved.dialect, "file");
    assert_eq!(resolved.path.as_deref(), Some("/tmp/a.csv"));
  }

  #[test]
  fn resolve_from_registry_loads_password() {
    let registry = ConnectionRegistry::default();
    {
      let mut map = registry.0.lock().unwrap();
      map.insert("c1".into(), mysql_payload("s3cret"));
    }

    let request = DialectPayload {
      connection_id: Some("c1".into()),
      dialect: String::new(),
      ..Default::default()
    };
    let resolved = resolve_payload(&registry, request).unwrap();
    assert_eq!(resolved.dialect, "mysql");
    assert_eq!(resolved.password.as_deref(), Some("s3cret"));
    assert_eq!(resolved.host.as_deref(), Some("127.0.0.1"));
    assert_eq!(resolved.username.as_deref(), Some("root"));
  }

  #[test]
  fn resolve_applies_database_override_without_dropping_password() {
    let registry = ConnectionRegistry::default();
    {
      let mut map = registry.0.lock().unwrap();
      map.insert("c1".into(), mysql_payload("s3cret"));
    }

    let request = DialectPayload {
      connection_id: Some("c1".into()),
      database: Some("other_db".into()),
      ..Default::default()
    };
    let resolved = resolve_payload(&registry, request).unwrap();
    assert_eq!(resolved.database.as_deref(), Some("other_db"));
    assert_eq!(resolved.password.as_deref(), Some("s3cret"));
    assert_eq!(resolved.host.as_deref(), Some("127.0.0.1"));
  }

  #[test]
  fn resolve_missing_connection_errors() {
    let registry = ConnectionRegistry::default();
    let request = DialectPayload {
      connection_id: Some("missing".into()),
      ..Default::default()
    };
    let err = resolve_payload(&registry, request).unwrap_err();
    assert!(err.contains("not registered"));
  }

  #[test]
  fn merge_secrets_into_payload_fills_credentials() {
    let base = DialectPayload {
      dialect: "postgres".into(),
      host: Some("pg".into()),
      port: Some("5432".into()),
      username: Some("u".into()),
      ..Default::default()
    };
    let secrets = ConnectionSecrets {
      password: Some("pw".into()),
      token: Some("tok".into()),
      ..Default::default()
    };
    let merged = merge_secrets_into_payload(base, &secrets);
    assert_eq!(merged.password.as_deref(), Some("pw"));
    assert_eq!(merged.token.as_deref(), Some("tok"));
    assert_eq!(merged.host.as_deref(), Some("pg"));
  }

  #[test]
  fn merge_secrets_ignores_empty_strings() {
    let base = DialectPayload {
      dialect: "mysql".into(),
      password: Some("keep".into()),
      ..Default::default()
    };
    let secrets = ConnectionSecrets {
      password: Some("".into()),
      ..Default::default()
    };
    let merged = merge_secrets_into_payload(base, &secrets);
    // empty secret must not overwrite existing password
    assert_eq!(merged.password.as_deref(), Some("keep"));
  }

  #[test]
  fn resolve_trims_connection_id() {
    let registry = ConnectionRegistry::default();
    {
      let mut map = registry.0.lock().unwrap();
      map.insert("c1".into(), mysql_payload("s3cret"));
    }
    let request = DialectPayload {
      connection_id: Some("  c1  ".into()),
      ..Default::default()
    };
    let resolved = resolve_payload(&registry, request).unwrap();
    assert_eq!(resolved.password.as_deref(), Some("s3cret"));
  }

  #[test]
  fn whitespace_only_connection_id_is_passthrough() {
    let registry = ConnectionRegistry::default();
    let payload = DialectPayload {
      connection_id: Some("   ".into()),
      dialect: "sqlite".into(),
      path: Some("/tmp/x.db".into()),
      ..Default::default()
    };
    let resolved = resolve_payload(&registry, payload).unwrap();
    assert_eq!(resolved.dialect, "sqlite");
    assert_eq!(resolved.path.as_deref(), Some("/tmp/x.db"));
  }

  #[test]
  fn resolve_dialect_override_and_empty_keeps_base() {
    let registry = ConnectionRegistry::default();
    {
      let mut map = registry.0.lock().unwrap();
      map.insert("c1".into(), mysql_payload("pw"));
    }

    let with_override = DialectPayload {
      connection_id: Some("c1".into()),
      dialect: "postgres".into(),
      ..Default::default()
    };
    let r1 = resolve_payload(&registry, with_override).unwrap();
    assert_eq!(r1.dialect, "postgres");
    assert_eq!(r1.password.as_deref(), Some("pw"));

    let empty_dialect = DialectPayload {
      connection_id: Some("c1".into()),
      dialect: String::new(),
      ..Default::default()
    };
    let r2 = resolve_payload(&registry, empty_dialect).unwrap();
    assert_eq!(r2.dialect, "mysql");
  }

  #[test]
  fn resolve_host_port_username_override() {
    let registry = ConnectionRegistry::default();
    {
      let mut map = registry.0.lock().unwrap();
      map.insert("c1".into(), mysql_payload("pw"));
    }
    let request = DialectPayload {
      connection_id: Some("c1".into()),
      host: Some("10.0.0.2".into()),
      port: Some("3307".into()),
      username: Some("admin".into()),
      ..Default::default()
    };
    let resolved = resolve_payload(&registry, request).unwrap();
    assert_eq!(resolved.host.as_deref(), Some("10.0.0.2"));
    assert_eq!(resolved.port.as_deref(), Some("3307"));
    assert_eq!(resolved.username.as_deref(), Some("admin"));
    assert_eq!(resolved.password.as_deref(), Some("pw"));
  }

  #[test]
  fn resolve_overlay_password_wins_when_present() {
    let registry = ConnectionRegistry::default();
    {
      let mut map = registry.0.lock().unwrap();
      map.insert("c1".into(), mysql_payload("base-pw"));
    }
    let request = DialectPayload {
      connection_id: Some("c1".into()),
      password: Some("overlay-pw".into()),
      ..Default::default()
    };
    let resolved = resolve_payload(&registry, request).unwrap();
    assert_eq!(resolved.password.as_deref(), Some("overlay-pw"));
  }

  #[test]
  fn merge_secrets_fills_ssh_fields() {
    let base = DialectPayload {
      dialect: "mysql".into(),
      ssh_enabled: Some(true),
      ..Default::default()
    };
    let secrets = ConnectionSecrets {
      ssh_password: Some("ssh-pw".into()),
      ssh_passphrase: Some("ssh-ph".into()),
      ..Default::default()
    };
    let merged = merge_secrets_into_payload(base, &secrets);
    assert_eq!(merged.ssh_password.as_deref(), Some("ssh-pw"));
    assert_eq!(merged.ssh_passphrase.as_deref(), Some("ssh-ph"));
  }

  #[test]
  fn apply_overrides_keeps_base_ssh_when_overlay_empty() {
    let base = DialectPayload {
      dialect: "mysql".into(),
      ssh_enabled: Some(true),
      ssh_host: Some("bastion".into()),
      ssh_port: Some("22".into()),
      ssh_username: Some("deploy".into()),
      ssh_password: Some("ssh".into()),
      ssh_private_key_path: Some("/k".into()),
      ssh_passphrase: Some("ph".into()),
      password: Some("db".into()),
      ..Default::default()
    };
    let overlay = DialectPayload {
      connection_id: Some("c1".into()),
      database: Some("db2".into()),
      ..Default::default()
    };
    let merged = apply_overrides(base, &overlay);
    assert_eq!(merged.database.as_deref(), Some("db2"));
    assert_eq!(merged.ssh_host.as_deref(), Some("bastion"));
    assert_eq!(merged.ssh_password.as_deref(), Some("ssh"));
    assert_eq!(merged.password.as_deref(), Some("db"));
  }

  #[test]
  fn registry_insert_and_remove_via_mutex() {
    let registry = ConnectionRegistry::default();
    {
      let mut map = registry.0.lock().unwrap();
      map.insert("a".into(), mysql_payload("1"));
      map.insert("b".into(), mysql_payload("2"));
      assert_eq!(map.len(), 2);
      map.remove("a");
      assert_eq!(map.len(), 1);
    }
    let err = resolve_payload(
      &registry,
      DialectPayload {
        connection_id: Some("a".into()),
        ..Default::default()
      },
    )
    .unwrap_err();
    assert!(err.contains("not registered"));
    let ok = resolve_payload(
      &registry,
      DialectPayload {
        connection_id: Some("b".into()),
        ..Default::default()
      },
    )
    .unwrap();
    assert_eq!(ok.password.as_deref(), Some("2"));
  }
}
