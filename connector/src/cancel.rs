use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::error::ConnectorError;

/// Cooperative cancellation token shared across async tasks / blocking work.
#[derive(Debug, Clone, Default)]
pub struct CancelToken {
  cancelled: Arc<AtomicBool>,
}

impl CancelToken {
  pub fn new() -> Self {
    Self {
      cancelled: Arc::new(AtomicBool::new(false)),
    }
  }

  pub fn cancel(&self) {
    self.cancelled.store(true, Ordering::SeqCst);
  }

  pub fn is_cancelled(&self) -> bool {
    self.cancelled.load(Ordering::SeqCst)
  }

  /// Return `Err(Cancelled)` if cancel was requested.
  pub fn check(&self) -> Result<(), ConnectorError> {
    if self.is_cancelled() {
      Err(ConnectorError::Cancelled)
    } else {
      Ok(())
    }
  }

  /// Poll until cancelled (for `tokio::select!` races).
  pub async fn cancelled(&self) {
    loop {
      if self.is_cancelled() {
        return;
      }
      tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
  }
}

/// Race an async operation against cancellation.
pub async fn with_cancel<T, F>(token: Option<&CancelToken>, fut: F) -> anyhow::Result<T>
where
  F: std::future::Future<Output = anyhow::Result<T>>,
{
  match token {
    None => fut.await,
    Some(token) => {
      tokio::select! {
        _ = token.cancelled() => Err(ConnectorError::Cancelled.into()),
        res = fut => res,
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::time::Duration;

  #[test]
  fn cancel_sets_flag() {
    let t = CancelToken::new();
    assert!(!t.is_cancelled());
    assert!(t.check().is_ok());
    t.cancel();
    assert!(t.is_cancelled());
    assert!(matches!(t.check(), Err(ConnectorError::Cancelled)));
  }

  #[tokio::test]
  async fn with_cancel_aborts_slow_future() {
    let token = CancelToken::new();
    let token2 = token.clone();
    tokio::spawn(async move {
      tokio::time::sleep(Duration::from_millis(30)).await;
      token2.cancel();
    });
    let res = with_cancel(
      Some(&token),
      async {
        tokio::time::sleep(Duration::from_secs(5)).await;
        Ok::<_, anyhow::Error>(42)
      },
    )
    .await;
    let err = res.unwrap_err();
    assert!(err.to_string().contains("cancel") || err.to_string().contains("cancelled"));
  }

  #[tokio::test]
  async fn with_cancel_none_runs_to_completion() {
    let res = with_cancel(None, async { Ok::<_, anyhow::Error>(7) }).await;
    assert_eq!(res.unwrap(), 7);
  }

  #[tokio::test]
  async fn with_cancel_fast_success() {
    let token = CancelToken::new();
    let res = with_cancel(Some(&token), async { Ok::<_, anyhow::Error>(1) }).await;
    assert_eq!(res.unwrap(), 1);
  }
}
