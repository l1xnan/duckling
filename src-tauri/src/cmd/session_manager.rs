use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use connector::dialect::Connection;

use super::db::DialectPayload;

struct CachedSession {
  fingerprint: u64,
  conn: Arc<dyn Connection>,
  last_used: Instant,
}

/// Process-lifetime live connections keyed by connection_id.
#[derive(Default)]
pub struct SessionManager {
  sessions: Mutex<HashMap<String, CachedSession>>,
}

impl SessionManager {
  pub fn fingerprint(payload: &DialectPayload) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    payload.dialect.hash(&mut hasher);
    payload.path.hash(&mut hasher);
    payload.username.hash(&mut hasher);
    payload.password.hash(&mut hasher);
    payload.host.hash(&mut hasher);
    payload.port.hash(&mut hasher);
    payload.database.hash(&mut hasher);
    payload.cwd.hash(&mut hasher);
    payload.uri.hash(&mut hasher);
    payload.token.hash(&mut hasher);
    payload.disable_ssl.hash(&mut hasher);
    payload.ssh_enabled.hash(&mut hasher);
    payload.ssh_host.hash(&mut hasher);
    payload.ssh_port.hash(&mut hasher);
    payload.ssh_username.hash(&mut hasher);
    payload.ssh_password.hash(&mut hasher);
    payload.ssh_private_key_path.hash(&mut hasher);
    payload.ssh_passphrase.hash(&mut hasher);
    hasher.finish()
  }

  pub fn get_or_insert(
    &self,
    connection_id: &str,
    payload: &DialectPayload,
    create: impl FnOnce() -> Result<Box<dyn Connection>, String>,
  ) -> Result<Arc<dyn Connection>, String> {
    let id = connection_id.trim();
    if id.is_empty() {
      return Err("connection id is required for session".into());
    }
    let fp = Self::fingerprint(payload);
    let mut map = self
      .sessions
      .lock()
      .map_err(|_| "session manager lock poisoned".to_string())?;

    if let Some(entry) = map.get_mut(id) {
      if entry.fingerprint == fp {
        entry.last_used = Instant::now();
        return Ok(Arc::clone(&entry.conn));
      }
      map.remove(id);
    }

    let conn: Arc<dyn Connection> = Arc::from(create()?);
    map.insert(
      id.to_string(),
      CachedSession {
        fingerprint: fp,
        conn: Arc::clone(&conn),
        last_used: Instant::now(),
      },
    );
    Ok(conn)
  }

  pub fn invalidate(&self, connection_id: &str) {
    let id = connection_id.trim();
    if id.is_empty() {
      return;
    }
    if let Ok(mut map) = self.sessions.lock() {
      map.remove(id);
    }
  }

  pub fn clear(&self) {
    if let Ok(mut map) = self.sessions.lock() {
      map.clear();
    }
  }

  #[cfg(test)]
  pub fn len(&self) -> usize {
    self.sessions.lock().map(|m| m.len()).unwrap_or(0)
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use connector::dialect::file::FileConnection;

  fn file_payload(path: &str) -> DialectPayload {
    DialectPayload {
      connection_id: Some("c1".into()),
      dialect: "file".into(),
      path: Some(path.into()),
      ..Default::default()
    }
  }

  #[test]
  fn reuses_session_when_fingerprint_matches() {
    let mgr = SessionManager::default();
    let p = file_payload("/tmp/a.csv");
    let a = mgr
      .get_or_insert("c1", &p, || {
        Ok(Box::new(FileConnection {
          path: "/tmp/a.csv".into(),
        }))
      })
      .unwrap();
    let b = mgr
      .get_or_insert("c1", &p, || {
        panic!("should not recreate");
      })
      .unwrap();
    assert!(Arc::ptr_eq(&a, &b));
    assert_eq!(mgr.len(), 1);
  }

  #[test]
  fn recreates_when_config_changes() {
    let mgr = SessionManager::default();
    let p1 = file_payload("/tmp/a.csv");
    let _ = mgr
      .get_or_insert("c1", &p1, || {
        Ok(Box::new(FileConnection {
          path: "/tmp/a.csv".into(),
        }))
      })
      .unwrap();
    let p2 = file_payload("/tmp/b.csv");
    let mut created = false;
    let _ = mgr
      .get_or_insert("c1", &p2, || {
        created = true;
        Ok(Box::new(FileConnection {
          path: "/tmp/b.csv".into(),
        }))
      })
      .unwrap();
    assert!(created);
    assert_eq!(mgr.len(), 1);
  }

  #[test]
  fn invalidate_drops_session() {
    let mgr = SessionManager::default();
    let p = file_payload("/tmp/a.csv");
    let _ = mgr
      .get_or_insert("c1", &p, || {
        Ok(Box::new(FileConnection {
          path: "/tmp/a.csv".into(),
        }))
      })
      .unwrap();
    mgr.invalidate("c1");
    assert_eq!(mgr.len(), 0);
  }
}
