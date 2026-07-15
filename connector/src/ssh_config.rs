use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde::Serialize;
use ssh2_config_rs::{ParseRule, SshConfig};

#[derive(Debug, Clone, Serialize)]
pub struct SshConfigHost {
  pub alias: String,
  pub host: String,
  pub port: u16,
  pub username: Option<String>,
  pub identity_file: Option<String>,
  pub label: String,
}

pub fn list_ssh_config_hosts() -> Vec<SshConfigHost> {
  let config = match SshConfig::parse_default_file(ParseRule::ALLOW_UNSUPPORTED_FIELDS) {
    Ok(config) => config,
    Err(err) => {
      log::warn!("failed to parse ~/.ssh/config: {err}");
      return vec![];
    }
  };

  let mut hosts = Vec::new();
  let mut seen = HashSet::new();

  for host in config.get_hosts() {
    for clause in &host.pattern {
      if clause.negated || !is_selectable_alias(&clause.pattern) {
        continue;
      }

      let alias = clause.pattern.clone();
      if !seen.insert(alias.clone()) {
        continue;
      }

      let params = config.query(&alias);
      let resolved_host = params
        .host_name
        .clone()
        .unwrap_or_else(|| alias.clone());
      let port = params.port.unwrap_or(22);
      let username = params.user.clone();
      let identity_file = params
        .identity_file
        .as_ref()
        .and_then(|files| files.first())
        .map(|path| expand_tilde(path));

      hosts.push(SshConfigHost {
        label: format_label(&alias, &resolved_host, port, username.as_deref()),
        alias,
        host: resolved_host,
        port,
        username,
        identity_file,
      });
    }
  }

  hosts.sort_by(|a, b| a.alias.cmp(&b.alias));
  hosts
}

fn is_selectable_alias(pattern: &str) -> bool {
  !pattern.is_empty()
    && pattern != "*"
    && !pattern.contains('*')
    && !pattern.contains('?')
}

fn format_label(alias: &str, host: &str, port: u16, username: Option<&str>) -> String {
  match username {
    Some(user) => format!("{alias} ({user}@{host}:{port})"),
    None => format!("{alias} ({host}:{port})"),
  }
}

fn expand_tilde(path: &Path) -> String {
  let raw = path.to_string_lossy();
  if raw == "~" || raw.starts_with("~/") || raw.starts_with("~\\") {
    if let Some(home) = home_dir() {
      let rest = raw
        .trim_start_matches('~')
        .trim_start_matches(['/', '\\']);
      if rest.is_empty() {
        return home.to_string_lossy().to_string();
      }
      return home.join(rest).to_string_lossy().to_string();
    }
  }
  raw.to_string()
}

fn home_dir() -> Option<PathBuf> {
  if cfg!(windows) {
    std::env::var_os("USERPROFILE").map(PathBuf::from)
  } else {
    std::env::var_os("HOME").map(PathBuf::from)
  }
}
