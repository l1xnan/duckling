use std::collections::HashMap;
use std::sync::Mutex;

use connector::CancelToken;

/// Tracks in-flight query cancellation tokens by request id.
#[derive(Default)]
pub struct InflightQueries {
  map: Mutex<HashMap<String, CancelToken>>,
}

impl InflightQueries {
  pub fn register(&self, request_id: &str) -> Result<CancelToken, String> {
    let id = request_id.trim();
    if id.is_empty() {
      return Err("request_id is required".into());
    }
    let token = CancelToken::new();
    let mut map = self
      .map
      .lock()
      .map_err(|_| "inflight lock poisoned".to_string())?;
    map.insert(id.to_string(), token.clone());
    Ok(token)
  }

  pub fn cancel(&self, request_id: &str) -> Result<bool, String> {
    let id = request_id.trim();
    if id.is_empty() {
      return Err("request_id is required".into());
    }
    let map = self
      .map
      .lock()
      .map_err(|_| "inflight lock poisoned".to_string())?;
    if let Some(token) = map.get(id) {
      token.cancel();
      Ok(true)
    } else {
      Ok(false)
    }
  }

  pub fn unregister(&self, request_id: &str) {
    let id = request_id.trim();
    if id.is_empty() {
      return;
    }
    if let Ok(mut map) = self.map.lock() {
      map.remove(id);
    }
  }

  #[cfg(test)]
  pub fn len(&self) -> usize {
    self.map.lock().map(|m| m.len()).unwrap_or(0)
  }
}

/// RAII guard that unregisters the request id when dropped.
pub struct InflightGuard<'a> {
  inflight: &'a InflightQueries,
  request_id: String,
}

impl<'a> InflightGuard<'a> {
  pub fn register(
    inflight: &'a InflightQueries,
    request_id: &str,
  ) -> Result<(Self, CancelToken), String> {
    let token = inflight.register(request_id)?;
    Ok((
      Self {
        inflight,
        request_id: request_id.trim().to_string(),
      },
      token,
    ))
  }
}

impl Drop for InflightGuard<'_> {
  fn drop(&mut self) {
    self.inflight.unregister(&self.request_id);
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn register_cancel_unregister() {
    let q = InflightQueries::default();
    let token = q.register("r1").unwrap();
    assert_eq!(q.len(), 1);
    assert!(!token.is_cancelled());
    assert!(q.cancel("r1").unwrap());
    assert!(token.is_cancelled());
    q.unregister("r1");
    assert_eq!(q.len(), 0);
    assert!(!q.cancel("r1").unwrap());
  }

  #[test]
  fn guard_unregisters_on_drop() {
    let q = InflightQueries::default();
    {
      let (_guard, token) = InflightGuard::register(&q, "r2").unwrap();
      assert_eq!(q.len(), 1);
      assert!(!token.is_cancelled());
    }
    assert_eq!(q.len(), 0);
  }

  #[test]
  fn empty_id_errors() {
    let q = InflightQueries::default();
    assert!(q.register("  ").is_err());
    assert!(q.cancel("").is_err());
  }
}
