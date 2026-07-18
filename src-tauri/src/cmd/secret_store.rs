use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::Argon2;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const SERVICE: &str = "app.duckling.connections";
const VAULT_DIR: &str = "connection-secrets";

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct ConnectionSecrets {
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub password: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub ssh_password: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub ssh_passphrase: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub token: Option<String>,
}

impl ConnectionSecrets {
  pub fn is_empty(&self) -> bool {
    fn empty(v: &Option<String>) -> bool {
      v.as_ref().map(|s| s.is_empty()).unwrap_or(true)
    }
    empty(&self.password)
      && empty(&self.ssh_password)
      && empty(&self.ssh_passphrase)
      && empty(&self.token)
  }
}

/// Load secrets from keychain / vault (used by connection registry).
pub async fn load_secrets(
  app: &AppHandle,
  connection_id: &str,
) -> Result<Option<ConnectionSecrets>, String> {
  secret_get(app.clone(), connection_id.to_string()).await
}

/// Persist secrets to keychain + vault.
pub async fn store_secrets(
  app: &AppHandle,
  connection_id: &str,
  secrets: &ConnectionSecrets,
) -> Result<(), String> {
  secret_set(app.clone(), connection_id.to_string(), secrets.clone()).await
}

fn vault_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?
    .join(VAULT_DIR);
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir)
}

/// Sanitize connection id for use as a vault filename stem.
pub(crate) fn sanitize_connection_id(connection_id: &str) -> String {
  connection_id
    .chars()
    .map(|c| {
      if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
        c
      } else {
        '_'
      }
    })
    .collect()
}

fn vault_path(app: &AppHandle, connection_id: &str) -> Result<PathBuf, String> {
  let safe = sanitize_connection_id(connection_id);
  Ok(vault_dir(app)?.join(format!("{safe}.json")))
}

fn keyring_entry(connection_id: &str) -> Result<keyring::Entry, String> {
  keyring::Entry::new(SERVICE, connection_id).map_err(|e| e.to_string())
}

fn write_vault_file(app: &AppHandle, connection_id: &str, secrets: &ConnectionSecrets) -> Result<(), String> {
  let path = vault_path(app, connection_id)?;
  let payload = serde_json::to_string(secrets).map_err(|e| e.to_string())?;
  fs::write(path, payload).map_err(|e| format!("vault write: {e}"))
}

fn read_vault_file(app: &AppHandle, connection_id: &str) -> Result<Option<ConnectionSecrets>, String> {
  let path = vault_path(app, connection_id)?;
  if !path.is_file() {
    return Ok(None);
  }
  let payload = fs::read_to_string(path).map_err(|e| format!("vault read: {e}"))?;
  let secrets: ConnectionSecrets =
    serde_json::from_str(&payload).map_err(|e| format!("vault parse: {e}"))?;
  if secrets.is_empty() {
    Ok(None)
  } else {
    Ok(Some(secrets))
  }
}

fn delete_vault_file(app: &AppHandle, connection_id: &str) -> Result<(), String> {
  let path = vault_path(app, connection_id)?;
  if path.is_file() {
    fs::remove_file(path).map_err(|e| format!("vault delete: {e}"))?;
  }
  Ok(())
}

fn write_keyring(connection_id: &str, secrets: &ConnectionSecrets) -> Result<(), String> {
  let payload = serde_json::to_string(secrets).map_err(|e| e.to_string())?;
  keyring_entry(connection_id)?
    .set_password(&payload)
    .map_err(|e| format!("keyring set: {e}"))
}

fn read_keyring(connection_id: &str) -> Result<Option<ConnectionSecrets>, String> {
  match keyring_entry(connection_id)?.get_password() {
    Ok(payload) => {
      let secrets: ConnectionSecrets =
        serde_json::from_str(&payload).map_err(|e| e.to_string())?;
      if secrets.is_empty() {
        Ok(None)
      } else {
        Ok(Some(secrets))
      }
    }
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(e) => Err(format!("keyring get: {e}")),
  }
}

fn delete_keyring(connection_id: &str) -> Result<(), String> {
  match keyring_entry(connection_id)?.delete_credential() {
    Ok(()) => Ok(()),
    Err(keyring::Error::NoEntry) => Ok(()),
    Err(e) => Err(format!("keyring delete: {e}")),
  }
}

#[tauri::command]
pub async fn secret_set(
  app: AppHandle,
  connection_id: String,
  secrets: ConnectionSecrets,
) -> Result<(), String> {
  if secrets.is_empty() {
    return secret_delete(app, connection_id).await;
  }

  // Dual-write: OS keychain (preferred) + app-data vault (survives keychain issues / reload).
  let mut keyring_err: Option<String> = None;
  let mut vault_err: Option<String> = None;

  if let Err(e) = write_keyring(&connection_id, &secrets) {
    log::warn!("secret_set keyring failed for {connection_id}: {e}");
    keyring_err = Some(e);
  }

  if let Err(e) = write_vault_file(&app, &connection_id, &secrets) {
    log::warn!("secret_set vault failed for {connection_id}: {e}");
    vault_err = Some(e);
  }

  if keyring_err.is_some() && vault_err.is_some() {
    return Err(format!(
      "failed to persist secrets (keyring: {}; vault: {})",
      keyring_err.unwrap_or_default(),
      vault_err.unwrap_or_default()
    ));
  }
  Ok(())
}

#[tauri::command]
pub async fn secret_get(
  app: AppHandle,
  connection_id: String,
) -> Result<Option<ConnectionSecrets>, String> {
  // Prefer keychain; fall back to vault file so reload works when keychain is empty.
  match read_keyring(&connection_id) {
    Ok(Some(secrets)) => return Ok(Some(secrets)),
    Ok(None) => {}
    Err(e) => log::warn!("secret_get keyring failed for {connection_id}: {e}"),
  }

  match read_vault_file(&app, &connection_id) {
    Ok(secrets) => Ok(secrets),
    Err(e) => {
      log::warn!("secret_get vault failed for {connection_id}: {e}");
      Ok(None)
    }
  }
}

#[tauri::command]
pub async fn secret_delete(app: AppHandle, connection_id: String) -> Result<(), String> {
  let mut errors = Vec::new();
  if let Err(e) = delete_keyring(&connection_id) {
    errors.push(e);
  }
  if let Err(e) = delete_vault_file(&app, &connection_id) {
    errors.push(e);
  }
  if errors.len() == 2 {
    return Err(errors.join("; "));
  }
  Ok(())
}

// ─── P2.1: encrypted connection export / import ─────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionProfileDto {
  pub id: String,
  #[serde(rename = "displayName")]
  pub display_name: String,
  pub dialect: String,
  #[serde(default)]
  pub config: Option<serde_json::Value>,
  #[serde(default, rename = "createdAt")]
  pub created_at: Option<i64>,
  #[serde(default, rename = "updatedAt")]
  pub updated_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionsExportDto {
  pub format: String,
  pub version: u32,
  #[serde(rename = "exportedAt")]
  pub exported_at: String,
  #[serde(rename = "includeSecrets")]
  pub include_secrets: bool,
  pub connections: Vec<ConnectionProfileDto>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub kdf: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub crypto: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub salt: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub nonce: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none", rename = "secretsBlob")]
  pub secrets_blob: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SecretsEnvelope {
  #[serde(rename = "byId")]
  by_id: HashMap<String, ConnectionSecrets>,
}

fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], String> {
  let mut key = [0u8; 32];
  Argon2::default()
    .hash_password_into(password.as_bytes(), salt, &mut key)
    .map_err(|e| format!("kdf failed: {e}"))?;
  Ok(key)
}

fn now_iso() -> String {
  use std::time::{SystemTime, UNIX_EPOCH};
  let secs = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_secs())
    .unwrap_or(0);
  format!("{secs}")
}

#[tauri::command]
pub async fn connections_export_encrypt(
  connections: Vec<ConnectionProfileDto>,
  secrets_by_id: HashMap<String, ConnectionSecrets>,
  password: String,
) -> Result<ConnectionsExportDto, String> {
  if password.trim().is_empty() {
    return Err("password is required".into());
  }

  let mut salt = [0u8; 16];
  let mut nonce_bytes = [0u8; 12];
  rand::thread_rng().fill_bytes(&mut salt);
  rand::thread_rng().fill_bytes(&mut nonce_bytes);

  let key = derive_key(&password, &salt)?;
  let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
  let nonce = Nonce::from_slice(&nonce_bytes);

  let envelope = SecretsEnvelope {
    by_id: secrets_by_id,
  };
  let plaintext = serde_json::to_vec(&envelope).map_err(|e| e.to_string())?;
  let ciphertext = cipher
    .encrypt(nonce, plaintext.as_ref())
    .map_err(|e| format!("encrypt failed: {e}"))?;

  Ok(ConnectionsExportDto {
    format: "duckling.connections".into(),
    version: 1,
    exported_at: now_iso(),
    include_secrets: true,
    connections,
    kdf: Some("argon2id".into()),
    crypto: Some("aes-256-gcm".into()),
    salt: Some(B64.encode(salt)),
    nonce: Some(B64.encode(nonce_bytes)),
    secrets_blob: Some(B64.encode(ciphertext)),
  })
}

#[tauri::command]
pub async fn connections_import_decrypt(
  file: ConnectionsExportDto,
  password: String,
) -> Result<HashMap<String, ConnectionSecrets>, String> {
  if password.trim().is_empty() {
    return Err("password is required".into());
  }
  if !file.include_secrets {
    return Ok(HashMap::new());
  }

  let salt_b64 = file.salt.ok_or("missing salt")?;
  let nonce_b64 = file.nonce.ok_or("missing nonce")?;
  let blob_b64 = file.secrets_blob.ok_or("missing secretsBlob")?;

  let salt = B64.decode(salt_b64).map_err(|e| e.to_string())?;
  let nonce_bytes = B64.decode(nonce_b64).map_err(|e| e.to_string())?;
  let ciphertext = B64.decode(blob_b64).map_err(|e| e.to_string())?;

  if nonce_bytes.len() != 12 {
    return Err("invalid nonce length".into());
  }

  let key = derive_key(&password, &salt)?;
  let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
  let nonce = Nonce::from_slice(&nonce_bytes);

  let plaintext = cipher
    .decrypt(nonce, ciphertext.as_ref())
    .map_err(|_| "invalid password or corrupted export".to_string())?;

  let envelope: SecretsEnvelope =
    serde_json::from_slice(&plaintext).map_err(|e| e.to_string())?;
  Ok(envelope.by_id)
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::collections::HashMap;

  fn block_on<F: std::future::Future>(f: F) -> F::Output {
    // Lightweight poll loop so we don't need tokio as a test dep.
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
  fn encrypt_decrypt_roundtrip() {
    let mut secrets = HashMap::new();
    secrets.insert(
      "c1".to_string(),
      ConnectionSecrets {
        password: Some("hello".into()),
        ssh_password: Some("ssh".into()),
        ..Default::default()
      },
    );

    let connections = vec![ConnectionProfileDto {
      id: "c1".into(),
      display_name: "Prod".into(),
      dialect: "mysql".into(),
      config: None,
      created_at: None,
      updated_at: None,
    }];

    let exported = block_on(connections_export_encrypt(
      connections,
      secrets,
      "master-pw".into(),
    ))
    .expect("encrypt");
    assert!(exported.include_secrets);
    assert_eq!(exported.kdf.as_deref(), Some("argon2id"));
    assert_eq!(exported.crypto.as_deref(), Some("aes-256-gcm"));
    assert!(exported.secrets_blob.is_some());
    let json = serde_json::to_string(&exported).unwrap();
    assert!(!json.contains("hello"));
    assert!(!json.contains("ssh"));

    let decrypted =
      block_on(connections_import_decrypt(exported, "master-pw".into())).expect("decrypt");
    assert_eq!(
      decrypted.get("c1").and_then(|s| s.password.as_deref()),
      Some("hello")
    );
    assert_eq!(
      decrypted.get("c1").and_then(|s| s.ssh_password.as_deref()),
      Some("ssh")
    );
  }

  #[test]
  fn decrypt_rejects_wrong_password() {
    let mut secrets = HashMap::new();
    secrets.insert(
      "c1".to_string(),
      ConnectionSecrets {
        password: Some("hello".into()),
        ..Default::default()
      },
    );
    let exported =
      block_on(connections_export_encrypt(vec![], secrets, "master-pw".into())).unwrap();
    let err = block_on(connections_import_decrypt(exported, "wrong".into())).unwrap_err();
    assert!(err.to_lowercase().contains("password") || err.contains("corrupted"));
  }

  #[test]
  fn encrypt_requires_password() {
    let err =
      block_on(connections_export_encrypt(vec![], HashMap::new(), "  ".into())).unwrap_err();
    assert!(err.contains("password"));
  }

  #[test]
  fn connection_secrets_is_empty() {
    assert!(ConnectionSecrets::default().is_empty());
    assert!(
      ConnectionSecrets {
        password: Some("".into()),
        ..Default::default()
      }
      .is_empty()
    );
    assert!(
      !ConnectionSecrets {
        password: Some("x".into()),
        ..Default::default()
      }
      .is_empty()
    );
  }

  #[test]
  fn sanitize_connection_id_keeps_safe_chars() {
    assert_eq!(sanitize_connection_id("abc-123_XYZ"), "abc-123_XYZ");
    // `.` is not alphanumeric; each unsafe char becomes `_`.
    assert_eq!(sanitize_connection_id("a/b:c*d?.json"), "a_b_c_d__json");
    assert_eq!(sanitize_connection_id(""), "");
  }

  #[test]
  fn import_without_secrets_returns_empty_map() {
    let file = ConnectionsExportDto {
      format: "duckling.connections".into(),
      version: 1,
      exported_at: "0".into(),
      include_secrets: false,
      connections: vec![],
      kdf: None,
      crypto: None,
      salt: None,
      nonce: None,
      secrets_blob: None,
    };
    let map = block_on(connections_import_decrypt(file, "any".into())).unwrap();
    assert!(map.is_empty());
  }

  #[test]
  fn import_requires_crypto_fields_when_include_secrets() {
    let base = ConnectionsExportDto {
      format: "duckling.connections".into(),
      version: 1,
      exported_at: "0".into(),
      include_secrets: true,
      connections: vec![],
      kdf: Some("argon2id".into()),
      crypto: Some("aes-256-gcm".into()),
      salt: None,
      nonce: None,
      secrets_blob: None,
    };
    assert!(
      block_on(connections_import_decrypt(base.clone(), "pw".into()))
        .unwrap_err()
        .contains("salt")
    );

    let mut missing_nonce = base.clone();
    missing_nonce.salt = Some(B64.encode([1u8; 16]));
    assert!(
      block_on(connections_import_decrypt(missing_nonce, "pw".into()))
        .unwrap_err()
        .contains("nonce")
    );

    let mut missing_blob = base;
    missing_blob.salt = Some(B64.encode([1u8; 16]));
    missing_blob.nonce = Some(B64.encode([2u8; 12]));
    assert!(
      block_on(connections_import_decrypt(missing_blob, "pw".into()))
        .unwrap_err()
        .contains("secretsBlob")
    );
  }

  #[test]
  fn import_rejects_invalid_nonce_length() {
    let mut secrets = HashMap::new();
    secrets.insert(
      "c1".to_string(),
      ConnectionSecrets {
        password: Some("x".into()),
        ..Default::default()
      },
    );
    let mut exported =
      block_on(connections_export_encrypt(vec![], secrets, "master".into())).unwrap();
    // Corrupt nonce to wrong decoded length (8 bytes instead of 12).
    exported.nonce = Some(B64.encode([9u8; 8]));
    let err = block_on(connections_import_decrypt(exported, "master".into())).unwrap_err();
    assert!(err.contains("nonce"));
  }

  #[test]
  fn decrypt_requires_password() {
    let file = ConnectionsExportDto {
      format: "duckling.connections".into(),
      version: 1,
      exported_at: "0".into(),
      include_secrets: true,
      connections: vec![],
      kdf: None,
      crypto: None,
      salt: Some("s".into()),
      nonce: Some("n".into()),
      secrets_blob: Some("b".into()),
    };
    let err = block_on(connections_import_decrypt(file, "   ".into())).unwrap_err();
    assert!(err.contains("password"));
  }

  #[test]
  fn export_json_never_contains_plaintext_secrets_for_multiple_ids() {
    let mut secrets = HashMap::new();
    secrets.insert(
      "a".into(),
      ConnectionSecrets {
        password: Some("pw-a".into()),
        token: Some("tok-a".into()),
        ..Default::default()
      },
    );
    secrets.insert(
      "b".into(),
      ConnectionSecrets {
        ssh_password: Some("ssh-b".into()),
        ssh_passphrase: Some("pass-b".into()),
        ..Default::default()
      },
    );
    let exported = block_on(connections_export_encrypt(
      vec![
        ConnectionProfileDto {
          id: "a".into(),
          display_name: "A".into(),
          dialect: "mysql".into(),
          config: None,
          created_at: None,
          updated_at: None,
        },
        ConnectionProfileDto {
          id: "b".into(),
          display_name: "B".into(),
          dialect: "postgres".into(),
          config: None,
          created_at: None,
          updated_at: None,
        },
      ],
      secrets,
      "master".into(),
    ))
    .unwrap();
    let json = serde_json::to_string(&exported).unwrap();
    for s in ["pw-a", "tok-a", "ssh-b", "pass-b"] {
      assert!(!json.contains(s), "leaked secret: {s}");
    }
    let decrypted = block_on(connections_import_decrypt(exported, "master".into())).unwrap();
    assert_eq!(decrypted.len(), 2);
    assert_eq!(
      decrypted.get("a").and_then(|s| s.password.as_deref()),
      Some("pw-a")
    );
    assert_eq!(
      decrypted.get("b").and_then(|s| s.ssh_password.as_deref()),
      Some("ssh-b")
    );
  }

  #[test]
  fn derive_key_is_deterministic_for_same_inputs() {
    let salt = [7u8; 16];
    let k1 = derive_key("pw", &salt).unwrap();
    let k2 = derive_key("pw", &salt).unwrap();
    let k3 = derive_key("other", &salt).unwrap();
    assert_eq!(k1, k2);
    assert_ne!(k1, k3);
  }
}
