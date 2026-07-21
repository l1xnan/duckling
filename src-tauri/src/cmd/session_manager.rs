use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use connector::dialect::Connection;

use super::db::DialectPayload;

/// Default idle TTL before a live session is dropped (15 minutes).
pub const DEFAULT_IDLE_TTL: Duration = Duration::from_secs(15 * 60);

struct CachedSession {
  fingerprint: u64,
  conn: Arc<dyn Connection>,
  last_used: Instant,
}

/// Process-lifetime live connections keyed by connection_id.
pub struct SessionManager {
  sessions: Mutex<HashMap<String, CachedSession>>,
  /// `None` or zero means never auto-evict by idle time.
  idle_ttl: Mutex<Option<Duration>>,
}

impl Default for SessionManager {
  fn default() -> Self {
    Self {
      sessions: Mutex::new(HashMap::new()),
      idle_ttl: Mutex::new(Some(DEFAULT_IDLE_TTL)),
    }
  }
}

impl SessionManager {
  #[allow(dead_code)]
  pub fn with_idle_ttl(idle_ttl: Duration) -> Self {
    Self {
      sessions: Mutex::new(HashMap::new()),
      idle_ttl: Mutex::new(Some(idle_ttl).filter(|d| !d.is_zero())),
    }
  }

  /// Update idle TTL at runtime. `secs == 0` disables idle eviction.
  pub fn set_idle_ttl_secs(&self, secs: u64) {
    if let Ok(mut ttl) = self.idle_ttl.lock() {
      *ttl = if secs == 0 {
        None
      } else {
        Some(Duration::from_secs(secs))
      };
    }
  }

  pub fn idle_ttl_secs(&self) -> u64 {
    self
      .idle_ttl
      .lock()
      .ok()
      .and_then(|g| *g)
      .map(|d| d.as_secs())
      .unwrap_or(0)
  }

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
    payload.ssl_mode.hash(&mut hasher);
    payload.ssh_enabled.hash(&mut hasher);
    payload.ssh_host.hash(&mut hasher);
    payload.ssh_port.hash(&mut hasher);
    payload.ssh_username.hash(&mut hasher);
    payload.ssh_password.hash(&mut hasher);
    payload.ssh_private_key_path.hash(&mut hasher);
    payload.ssh_passphrase.hash(&mut hasher);
    payload.ssh_host_key_policy.hash(&mut hasher);
    hasher.finish()
  }

  /// Drop sessions whose `last_used` is older than `idle_ttl`. Returns count removed.
  pub fn evict_idle(&self) -> usize {
    self.evict_idle_at(Instant::now())
  }

  fn evict_idle_at(&self, now: Instant) -> usize {
    let ttl = match self.idle_ttl.lock().ok().and_then(|g| *g) {
      Some(d) if !d.is_zero() => d,
      _ => return 0,
    };
    let Ok(mut map) = self.sessions.lock() else {
      return 0;
    };
    let before = map.len();
    map.retain(|_, s| now.duration_since(s.last_used) < ttl);
    before.saturating_sub(map.len())
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
    // Opportunistic cleanup of other idle sessions.
    let _ = self.evict_idle();

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

  #[allow(dead_code)]
  pub fn clear(&self) {
    if let Ok(mut map) = self.sessions.lock() {
      map.clear();
    }
  }

  #[cfg(test)]
  pub fn len(&self) -> usize {
    self.sessions.lock().map(|m| m.len()).unwrap_or(0)
  }

  #[cfg(test)]
  fn set_last_used_for_test(&self, connection_id: &str, when: Instant) {
    if let Ok(mut map) = self.sessions.lock() {
      if let Some(entry) = map.get_mut(connection_id) {
        entry.last_used = when;
      }
    }
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

  #[test]
  fn evict_idle_removes_stale_sessions() {
    let mgr = SessionManager::with_idle_ttl(Duration::from_millis(50));
    let p = file_payload("/tmp/a.csv");
    let _ = mgr
      .get_or_insert("c1", &p, || {
        Ok(Box::new(FileConnection {
          path: "/tmp/a.csv".into(),
        }))
      })
      .unwrap();
    assert_eq!(mgr.len(), 1);
    // Backdate last_used past TTL.
    mgr.set_last_used_for_test("c1", Instant::now() - Duration::from_secs(1));
    let removed = mgr.evict_idle();
    assert_eq!(removed, 1);
    assert_eq!(mgr.len(), 0);
  }

  #[test]
  fn get_or_insert_evicts_other_idle_sessions() {
    let mgr = SessionManager::with_idle_ttl(Duration::from_millis(50));
    let p1 = file_payload("/tmp/a.csv");
    let _ = mgr
      .get_or_insert("old", &p1, || {
        Ok(Box::new(FileConnection {
          path: "/tmp/a.csv".into(),
        }))
      })
      .unwrap();
    mgr.set_last_used_for_test("old", Instant::now() - Duration::from_secs(1));

    let p2 = DialectPayload {
      connection_id: Some("new".into()),
      dialect: "file".into(),
      path: Some("/tmp/b.csv".into()),
      ..Default::default()
    };
    let _ = mgr
      .get_or_insert("new", &p2, || {
        Ok(Box::new(FileConnection {
          path: "/tmp/b.csv".into(),
        }))
      })
      .unwrap();
    assert_eq!(mgr.len(), 1);
    // only "new" remains
    let again = mgr
      .get_or_insert("new", &p2, || panic!("should reuse new"))
      .unwrap();
    assert_eq!(again.dialect(), "file");
  }

  #[test]
  fn set_idle_ttl_secs_updates_and_zero_disables() {
    let mgr = SessionManager::default();
    assert_eq!(mgr.idle_ttl_secs(), 15 * 60);
    mgr.set_idle_ttl_secs(120);
    assert_eq!(mgr.idle_ttl_secs(), 120);

    let p = file_payload("/tmp/a.csv");
    let _ = mgr
      .get_or_insert("c1", &p, || {
        Ok(Box::new(FileConnection {
          path: "/tmp/a.csv".into(),
        }))
      })
      .unwrap();
    mgr.set_last_used_for_test("c1", Instant::now() - Duration::from_secs(10));
    // TTL 120s → not yet idle
    assert_eq!(mgr.evict_idle(), 0);
    assert_eq!(mgr.len(), 1);

    mgr.set_idle_ttl_secs(0);
    assert_eq!(mgr.idle_ttl_secs(), 0);
    mgr.set_last_used_for_test("c1", Instant::now() - Duration::from_secs(3600));
    // disabled eviction
    assert_eq!(mgr.evict_idle(), 0);
    assert_eq!(mgr.len(), 1);
  }
}
