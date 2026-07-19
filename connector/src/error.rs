use std::fmt;

/// Structured connector errors for IPC mapping and UI handling.
#[derive(Debug)]
pub enum ConnectorError {
  Unsupported(&'static str),
  Auth(String),
  Network(String),
  Sql(String),
  Cancelled,
  Config(String),
  Internal(String),
}

impl ConnectorError {
  pub fn unsupported(op: &'static str) -> Self {
    Self::Unsupported(op)
  }

  pub fn cancelled() -> Self {
    Self::Cancelled
  }

  /// Stable machine-readable code for frontend / ArrowResponse.
  pub fn code(&self) -> &'static str {
    match self {
      Self::Unsupported(_) => "unsupported",
      Self::Auth(_) => "auth",
      Self::Network(_) => "network",
      Self::Sql(_) => "sql",
      Self::Cancelled => "cancelled",
      Self::Config(_) => "config",
      Self::Internal(_) => "internal",
    }
  }

  /// Numeric code aligned with existing ArrowResponse convention (0 = ok).
  pub fn http_like_code(&self) -> i32 {
    match self {
      Self::Unsupported(_) => 405,
      Self::Auth(_) => 401,
      Self::Network(_) => 502,
      Self::Sql(_) => 400,
      Self::Cancelled => 499,
      Self::Config(_) => 422,
      Self::Internal(_) => 500,
    }
  }

  /// Best-effort classify an opaque error string (e.g. from anyhow).
  pub fn classify(message: &str) -> Self {
    let lower = message.to_ascii_lowercase();
    if lower.contains("operation not supported") || lower.contains("unsupported") {
      return Self::Unsupported("unknown");
    }
    if lower.contains("cancel") {
      return Self::Cancelled;
    }
    if lower.contains("password")
      || lower.contains("auth")
      || lower.contains("permission denied")
      || lower.contains("access denied")
    {
      return Self::Auth(message.to_string());
    }
    if lower.contains("connection")
      || lower.contains("timeout")
      || lower.contains("network")
      || lower.contains("refused")
      || lower.contains("reset")
    {
      return Self::Network(message.to_string());
    }
    if lower.contains("syntax")
      || lower.contains("sql")
      || lower.contains("query")
      || lower.contains("relation")
      || lower.contains("table")
    {
      return Self::Sql(message.to_string());
    }
    Self::Internal(message.to_string())
  }
}

impl fmt::Display for ConnectorError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      Self::Unsupported(op) => write!(f, "operation not supported: {op}"),
      Self::Auth(msg) => write!(f, "authentication failed: {msg}"),
      Self::Network(msg) => write!(f, "network error: {msg}"),
      Self::Sql(msg) => write!(f, "sql error: {msg}"),
      Self::Cancelled => write!(f, "operation cancelled"),
      Self::Config(msg) => write!(f, "invalid config: {msg}"),
      Self::Internal(msg) => write!(f, "{msg}"),
    }
  }
}

impl std::error::Error for ConnectorError {}

impl From<anyhow::Error> for ConnectorError {
  fn from(err: anyhow::Error) -> Self {
    Self::classify(&err.to_string())
  }
}

// Note: std::error::Error + Display already lets `?` / `.into()` build anyhow::Error.

/// Map connector/anyhow errors to (code, message) for ArrowResponse.
pub fn arrow_error_parts(err: &anyhow::Error) -> (i32, String) {
  let classified = ConnectorError::classify(&err.to_string());
  (classified.http_like_code(), classified.to_string())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn codes_are_stable() {
    assert_eq!(ConnectorError::unsupported("find").code(), "unsupported");
    assert_eq!(ConnectorError::cancelled().code(), "cancelled");
    assert_eq!(ConnectorError::Sql("x".into()).http_like_code(), 400);
    assert_eq!(ConnectorError::Cancelled.http_like_code(), 499);
  }

  #[test]
  fn classify_unsupported_and_cancel() {
    let e = ConnectorError::classify("operation not supported: find");
    assert_eq!(e.code(), "unsupported");
    let e = ConnectorError::classify("query cancelled by user");
    assert_eq!(e.code(), "cancelled");
  }

  #[test]
  fn classify_network_and_auth() {
    assert_eq!(
      ConnectorError::classify("connection refused").code(),
      "network"
    );
    assert_eq!(
      ConnectorError::classify("Access denied for user").code(),
      "auth"
    );
  }

  #[test]
  fn display_and_anyhow_roundtrip() {
    let e = ConnectorError::unsupported("export");
    let a = anyhow::Error::new(e);
    assert!(a.to_string().contains("export"));
    let back = ConnectorError::from(a);
    assert_eq!(back.code(), "unsupported");
  }

  #[test]
  fn arrow_error_parts_numeric() {
    let err = anyhow::anyhow!("operation not supported: drop_table");
    let (code, msg) = arrow_error_parts(&err);
    assert_eq!(code, 405);
    assert!(msg.contains("not supported"));
  }
}
