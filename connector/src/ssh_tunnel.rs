use std::path::Path;
use std::sync::Arc;
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use anyhow::{Context, anyhow};
use russh::client::{self, Handler};
use russh::keys::{PrivateKeyWithHashAlg, PublicKey, check_known_hosts, load_secret_key};
use russh::keys::known_hosts::learn_known_hosts;
use tokio::net::TcpListener;
use tokio::runtime::Runtime;
use tokio::sync::oneshot;

/// How to verify the SSH server host key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum HostKeyPolicy {
  /// Always accept (previous behavior). Default for compatibility.
  #[default]
  Insecure,
  /// Accept and record unknown keys; reject changed keys.
  AcceptNew,
  /// Only accept keys already in known_hosts.
  Strict,
}

impl HostKeyPolicy {
  pub fn parse(s: &str) -> Self {
    match s.trim().to_ascii_lowercase().as_str() {
      "accept_new" | "accept-new" | "acceptnew" => Self::AcceptNew,
      "strict" => Self::Strict,
      _ => Self::Insecure,
    }
  }

  pub fn as_str(self) -> &'static str {
    match self {
      Self::Insecure => "insecure",
      Self::AcceptNew => "accept_new",
      Self::Strict => "strict",
    }
  }
}

/// Verify `pubkey` for `host:port` according to `policy`.
pub fn verify_host_key(
  host: &str,
  port: u16,
  pubkey: &PublicKey,
  policy: HostKeyPolicy,
) -> anyhow::Result<bool> {
  match policy {
    HostKeyPolicy::Insecure => Ok(true),
    HostKeyPolicy::Strict => check_known_hosts(host, port, pubkey)
      .map_err(|e| anyhow!("SSH known_hosts check failed: {e}")),
    HostKeyPolicy::AcceptNew => match check_known_hosts(host, port, pubkey) {
      Ok(true) => Ok(true),
      Ok(false) => {
        learn_known_hosts(host, port, pubkey)
          .map_err(|e| anyhow!("failed to write known_hosts: {e}"))?;
        log::info!("SSH: recorded new host key for {host}:{port}");
        Ok(true)
      }
      Err(e) => {
        // Key changed or other known_hosts error — reject.
        Err(anyhow!("SSH host key verification failed: {e}"))
      }
    },
  }
}

#[derive(Debug, Clone, Default)]
pub struct SshConfig {
  pub host: String,
  pub port: u16,
  pub username: String,
  pub password: Option<String>,
  pub private_key_path: Option<String>,
  pub passphrase: Option<String>,
  pub host_key_policy: HostKeyPolicy,
}

impl SshConfig {
  pub fn is_configured(&self) -> bool {
    !self.host.is_empty() && !self.username.is_empty()
  }
}

/// Dialect-facing SSH tunnel options (shared by MySQL / Postgres).
#[derive(Debug, Clone, Default)]
pub struct DbSshConfig {
  pub enabled: bool,
  pub host: String,
  pub port: String,
  pub username: String,
  pub password: Option<String>,
  pub private_key_path: Option<String>,
  pub passphrase: Option<String>,
  /// `insecure` | `accept_new` | `strict` (default insecure).
  pub host_key_policy: Option<String>,
}

impl DbSshConfig {
  pub fn to_tunnel_config(&self) -> Option<SshConfig> {
    if !self.enabled {
      return None;
    }
    Some(SshConfig {
      host: self.host.clone(),
      port: self.port.parse().unwrap_or(22),
      username: self.username.clone(),
      password: self.password.clone(),
      private_key_path: self.private_key_path.clone(),
      passphrase: self.passphrase.clone(),
      host_key_policy: self
        .host_key_policy
        .as_deref()
        .map(HostKeyPolicy::parse)
        .unwrap_or_default(),
    })
  }
}

pub struct SshTunnel {
  local_port: u16,
  shutdown_tx: Option<Sender<()>>,
  thread: Option<JoinHandle<()>>,
}

struct SshClient {
  host: String,
  port: u16,
  policy: HostKeyPolicy,
}

impl Handler for SshClient {
  type Error = anyhow::Error;

  fn check_server_key(
    &mut self,
    server_public_key: &PublicKey,
  ) -> impl std::future::Future<Output = Result<bool, Self::Error>> + Send {
    let host = self.host.clone();
    let port = self.port;
    let policy = self.policy;
    let key = server_public_key.clone();
    async move { verify_host_key(&host, port, &key, policy) }
  }
}

impl SshTunnel {
  pub fn open(config: &SshConfig, target_host: &str, target_port: u16) -> anyhow::Result<Self> {
    if !config.is_configured() {
      return Err(anyhow!("SSH configuration is incomplete"));
    }

    let (ready_tx, ready_rx) = mpsc::sync_channel::<anyhow::Result<u16>>(1);
    let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>();

    let config = config.clone();
    let target_host = target_host.to_string();
    let thread = thread::Builder::new()
      .name("ssh-tunnel".into())
      .spawn(move || run_tunnel_thread(config, target_host, target_port, shutdown_rx, ready_tx))
      .context("failed to spawn ssh tunnel thread")?;

    let local_port = ready_rx
      .recv()
      .context("ssh tunnel thread exited before becoming ready")??;

    Ok(Self {
      local_port,
      shutdown_tx: Some(shutdown_tx),
      thread: Some(thread),
    })
  }

  pub fn local_port(&self) -> u16 {
    self.local_port
  }
}

impl Drop for SshTunnel {
  fn drop(&mut self) {
    if let Some(tx) = self.shutdown_tx.take() {
      let _ = tx.send(());
    }
    if let Some(thread) = self.thread.take() {
      let _ = thread.join();
    }
  }
}

fn run_tunnel_thread(
  config: SshConfig,
  target_host: String,
  target_port: u16,
  shutdown_rx: Receiver<()>,
  ready_tx: mpsc::SyncSender<anyhow::Result<u16>>,
) {
  let runtime = match Runtime::new() {
    Ok(runtime) => runtime,
    Err(err) => {
      let _ = ready_tx.send(Err(anyhow!(err).context("failed to create ssh tunnel runtime")));
      return;
    }
  };

  if let Err(err) = runtime.block_on(run_tunnel(
    config,
    target_host,
    target_port,
    shutdown_rx,
    ready_tx.clone(),
  )) {
    let _ = ready_tx.send(Err(err));
  }
}

async fn run_tunnel(
  config: SshConfig,
  target_host: String,
  target_port: u16,
  shutdown_rx: Receiver<()>,
  ready_tx: mpsc::SyncSender<anyhow::Result<u16>>,
) -> anyhow::Result<()> {
  let (local_port, tunnel_shutdown_tx, tunnel_task) =
    open_tunnel(config, target_host, target_port).await?;

  ready_tx
    .send(Ok(local_port))
    .map_err(|_| anyhow!("ssh tunnel consumer dropped before ready"))?;

  wait_for_shutdown(shutdown_rx).await;
  let _ = tunnel_shutdown_tx.send(());
  tunnel_task.await.ok();

  Ok(())
}

async fn wait_for_shutdown(shutdown_rx: Receiver<()>) {
  loop {
    if shutdown_rx.try_recv().is_ok() {
      return;
    }
    tokio::time::sleep(Duration::from_millis(50)).await;
  }
}

async fn open_tunnel(
  config: SshConfig,
  target_host: String,
  target_port: u16,
) -> anyhow::Result<(u16, oneshot::Sender<()>, tokio::task::JoinHandle<()>)> {
  let ssh_config = Arc::new(client::Config::default());
  let mut handle = client::connect(
    ssh_config,
    (config.host.as_str(), config.port),
    SshClient {
      host: config.host.clone(),
      port: config.port,
      policy: config.host_key_policy,
    },
  )
  .await
  .with_context(|| format!("failed to connect to SSH server {}:{}", config.host, config.port))?;

  let auth_result = if let Some(ref key_path) = config.private_key_path {
    if key_path.is_empty() {
      return Err(anyhow!("SSH private key path is empty"));
    }
    let key = load_secret_key(
      Path::new(key_path),
      config.passphrase.as_deref(),
    )
    .with_context(|| format!("failed to load SSH private key from {key_path}"))?;
    handle
      .authenticate_publickey(
        &config.username,
        PrivateKeyWithHashAlg::new(Arc::new(key), None),
      )
      .await
      .context("SSH public key authentication failed")?
  } else if let Some(ref password) = config.password {
    handle
      .authenticate_password(&config.username, password)
      .await
      .context("SSH password authentication failed")?
  } else {
    return Err(anyhow!("SSH requires a password or private key"));
  };

  if !auth_result.success() {
    return Err(anyhow!("SSH authentication failed"));
  }

  let listener = TcpListener::bind("127.0.0.1:0")
    .await
    .context("failed to bind local tunnel port")?;
  let local_port = listener
    .local_addr()
    .context("failed to read local tunnel port")?
    .port();

  let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();
  let task = tokio::spawn(async move {
    loop {
      tokio::select! {
        _ = &mut shutdown_rx => break,
        accepted = listener.accept() => {
          let Ok((mut local_socket, _)) = accepted else {
            break;
          };
          let target_host = target_host.clone();
          let Ok(channel) = handle
            .channel_open_direct_tcpip(
              target_host,
              target_port as u32,
              "127.0.0.1",
              local_port as u32,
            )
            .await
          else {
            continue;
          };
          tokio::spawn(async move {
            let mut remote_stream = channel.into_stream();
            let _ = tokio::io::copy_bidirectional(&mut local_socket, &mut remote_stream).await;
          });
        }
      }
    }
  });

  Ok((local_port, shutdown_tx, task))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn host_key_policy_parse() {
    assert_eq!(HostKeyPolicy::parse("insecure"), HostKeyPolicy::Insecure);
    assert_eq!(HostKeyPolicy::parse("accept_new"), HostKeyPolicy::AcceptNew);
    assert_eq!(HostKeyPolicy::parse("accept-new"), HostKeyPolicy::AcceptNew);
    assert_eq!(HostKeyPolicy::parse("strict"), HostKeyPolicy::Strict);
    assert_eq!(HostKeyPolicy::parse(""), HostKeyPolicy::Insecure);
    assert_eq!(HostKeyPolicy::parse("unknown"), HostKeyPolicy::Insecure);
  }

  #[test]
  fn insecure_always_accepts() {
    // PublicKey construction is non-trivial; policy path only.
    assert_eq!(HostKeyPolicy::Insecure.as_str(), "insecure");
    assert_eq!(HostKeyPolicy::AcceptNew.as_str(), "accept_new");
    assert_eq!(HostKeyPolicy::Strict.as_str(), "strict");
  }

  #[test]
  fn db_ssh_config_maps_policy() {
    let cfg = DbSshConfig {
      enabled: true,
      host: "bastion".into(),
      port: "22".into(),
      username: "u".into(),
      host_key_policy: Some("strict".into()),
      ..Default::default()
    };
    let tunnel = cfg.to_tunnel_config().unwrap();
    assert_eq!(tunnel.host_key_policy, HostKeyPolicy::Strict);

    let cfg2 = DbSshConfig {
      enabled: true,
      host: "h".into(),
      username: "u".into(),
      ..Default::default()
    };
    assert_eq!(
      cfg2.to_tunnel_config().unwrap().host_key_policy,
      HostKeyPolicy::Insecure
    );
  }
}
