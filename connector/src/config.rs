use crate::dialect::Connection;
use crate::dialect::clickhouse::ClickhouseConnection;
use crate::dialect::duckdb::DuckDbConnection;
use crate::dialect::file::FileConnection;
use crate::dialect::folder::FolderConnection;
use crate::dialect::mysql::MySqlConnection;
use crate::dialect::postgres::PostgresConnection;
use crate::dialect::quack::QuackConnection;
use crate::dialect::sqlite::SqliteConnection;
use crate::ssh_tunnel::DbSshConfig;

/// Fully-resolved connection configuration (secrets already merged).
#[derive(Debug, Clone, Default)]
pub struct ConnectionConfig {
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
  pub disable_ssl: Option<bool>,
  pub ssh: Option<DbSshConfig>,
}

impl ConnectionConfig {
  pub fn with_ssh(
    mut self,
    enabled: Option<bool>,
    host: Option<String>,
    port: Option<String>,
    username: Option<String>,
    password: Option<String>,
    private_key_path: Option<String>,
    passphrase: Option<String>,
  ) -> Self {
    self.ssh = enabled.filter(|e| *e).map(|_| DbSshConfig {
      enabled: true,
      host: host.unwrap_or_default(),
      port: port.unwrap_or_else(|| "22".to_string()),
      username: username.unwrap_or_default(),
      password,
      private_key_path,
      passphrase,
    });
    self
  }
}

/// Open a dialect connection from a fully-resolved config.
pub fn open(config: ConnectionConfig) -> anyhow::Result<Box<dyn Connection>> {
  match config.dialect.as_str() {
    "folder" => Ok(Box::new(FolderConnection {
      path: config
        .path
        .ok_or_else(|| anyhow::anyhow!("path required for folder"))?,
      cwd: config.cwd,
    })),
    "file" => Ok(Box::new(FileConnection {
      path: config
        .path
        .ok_or_else(|| anyhow::anyhow!("path required for file"))?,
    })),
    "duckdb" => Ok(Box::new(DuckDbConnection {
      path: config
        .path
        .ok_or_else(|| anyhow::anyhow!("path required for duckdb"))?,
      cwd: config.cwd,
    })),
    "sqlite" => Ok(Box::new(SqliteConnection {
      path: config
        .path
        .ok_or_else(|| anyhow::anyhow!("path required for sqlite"))?,
    })),
    "clickhouse" => Ok(Box::new(ClickhouseConnection {
      host: config
        .host
        .ok_or_else(|| anyhow::anyhow!("host required for clickhouse"))?,
      port: config.port.unwrap_or_default(),
      username: config.username.unwrap_or_default(),
      password: config.password.unwrap_or_default(),
      database: config.database,
    })),
    "mysql" => Ok(Box::new(MySqlConnection::new(
      config
        .host
        .ok_or_else(|| anyhow::anyhow!("host required for mysql"))?,
      config
        .port
        .ok_or_else(|| anyhow::anyhow!("port required for mysql"))?,
      config.username.unwrap_or_default(),
      config.password.unwrap_or_default(),
      config.database,
      config.ssh,
    ))),
    "postgres" => Ok(Box::new(PostgresConnection::new(
      config
        .host
        .ok_or_else(|| anyhow::anyhow!("host required for postgres"))?,
      config
        .port
        .ok_or_else(|| anyhow::anyhow!("port required for postgres"))?,
      config.username.unwrap_or_default(),
      config.password.unwrap_or_default(),
      config.database,
      config.ssh,
    ))),
    "quack" => Ok(Box::new(QuackConnection {
      uri: config
        .uri
        .ok_or_else(|| anyhow::anyhow!("uri required for quack"))?,
      token: config.token,
      disable_ssl: config.disable_ssl.unwrap_or(false),
    })),
    other => Err(anyhow::anyhow!("unsupported dialect: {other}")),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn open_file_and_sqlite() {
    let file = open(ConnectionConfig {
      dialect: "file".into(),
      path: Some("/tmp/a.parquet".into()),
      ..Default::default()
    })
    .unwrap();
    assert_eq!(file.dialect(), "generic");

    let sqlite = open(ConnectionConfig {
      dialect: "sqlite".into(),
      path: Some("/tmp/a.db".into()),
      ..Default::default()
    })
    .unwrap();
    assert_eq!(sqlite.dialect(), "generic");
  }

  #[test]
  fn open_rejects_unknown() {
    let result = open(ConnectionConfig {
      dialect: "not-a-db".into(),
      ..Default::default()
    });
    assert!(result.is_err());
    assert!(
      result
        .err()
        .map(|e| e.to_string())
        .unwrap_or_default()
        .contains("unsupported dialect")
    );
  }

  #[test]
  fn open_network_dialects() {
    for dialect in ["mysql", "postgres", "clickhouse"] {
      let cfg = ConnectionConfig {
        dialect: dialect.into(),
        host: Some("127.0.0.1".into()),
        port: Some("3306".into()),
        username: Some("u".into()),
        password: Some("p".into()),
        database: Some("d".into()),
        ..Default::default()
      };
      assert!(open(cfg).is_ok(), "failed for {dialect}");
    }
  }

  #[test]
  fn with_ssh_builds_config() {
    let cfg = ConnectionConfig {
      dialect: "mysql".into(),
      host: Some("db".into()),
      port: Some("3306".into()),
      ..Default::default()
    }
    .with_ssh(
      Some(true),
      Some("bastion".into()),
      None,
      Some("deploy".into()),
      Some("pw".into()),
      None,
      None,
    );
    let ssh = cfg.ssh.unwrap();
    assert!(ssh.enabled);
    assert_eq!(ssh.host, "bastion");
    assert_eq!(ssh.port, "22");
    assert_eq!(ssh.username, "deploy");
  }
}
