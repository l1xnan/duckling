use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::Instant;

use serde::Deserialize;
use serde::Serialize;
use sqlformat::{FormatOptions, QueryParams};
use tauri::{Manager, State};
#[cfg(desktop)]
use tauri_plugin_updater::UpdaterExt;

use crate::api::ArrowResponse;
use crate::connection_registry::{self, ConnectionRegistry};
use connector::dialect::Connection;
use connector::dialect::clickhouse::ClickhouseConnection;
use connector::dialect::duckdb::DuckDbConnection;
use connector::dialect::file::FileConnection;
use connector::dialect::folder::FolderConnection;
use connector::dialect::mysql::MySqlConnection;
use connector::dialect::postgres::PostgresConnection;
use connector::dialect::quack::QuackConnection;
use connector::dialect::sqlite::SqliteConnection;
use connector::utils::{Metadata, TreeNode};

pub struct OpenedFiles(pub Mutex<Option<Vec<String>>>);

pub(crate) fn build_ssh_config(
  ssh_enabled: Option<bool>,
  ssh_host: Option<String>,
  ssh_port: Option<String>,
  ssh_username: Option<String>,
  ssh_password: Option<String>,
  ssh_private_key_path: Option<String>,
  ssh_passphrase: Option<String>,
) -> Option<connector::ssh_tunnel::DbSshConfig> {
  ssh_enabled.filter(|enabled| *enabled).map(|_| {
    connector::ssh_tunnel::DbSshConfig {
      enabled: true,
      host: ssh_host.unwrap_or_default(),
      port: ssh_port.unwrap_or_else(|| "22".to_string()),
      username: ssh_username.unwrap_or_default(),
      password: ssh_password,
      private_key_path: ssh_private_key_path,
      passphrase: ssh_passphrase,
    }
  })
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct DialectPayload {
  /// When set, credentials are loaded from the in-memory connection registry.
  /// Accept both camelCase (JS) and snake_case.
  #[serde(default, alias = "connectionId")]
  pub connection_id: Option<String>,
  #[serde(default)]
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
  /// Frontend DialectConfig uses snake_case (`disable_ssl`); also accept camelCase.
  #[serde(default, alias = "disableSsl")]
  pub disable_ssl: Option<bool>,
  #[serde(default, alias = "sshEnabled")]
  pub ssh_enabled: Option<bool>,
  #[serde(default, alias = "sshHost")]
  pub ssh_host: Option<String>,
  #[serde(default, alias = "sshPort")]
  pub ssh_port: Option<String>,
  #[serde(default, alias = "sshUsername")]
  pub ssh_username: Option<String>,
  #[serde(default, alias = "sshPassword")]
  pub ssh_password: Option<String>,
  #[serde(default, alias = "sshPrivateKeyPath")]
  pub ssh_private_key_path: Option<String>,
  #[serde(default, alias = "sshPassphrase")]
  pub ssh_passphrase: Option<String>,
}

#[allow(clippy::unused_async)]
pub fn get_ast_dialect(dialect: &str) -> Box<dyn sqlparser::dialect::Dialect> {
  match dialect {
    "folder" | "file" | "duckdb" | "quack" => Box::new(sqlparser::dialect::DuckDbDialect {}),
    "clickhouse" => Box::new(sqlparser::dialect::ClickHouseDialect {}),
    "mysql" => Box::new(sqlparser::dialect::MySqlDialect {}),
    "postgres" => Box::new(sqlparser::dialect::PostgreSqlDialect {}),
    _ => Box::new(sqlparser::dialect::GenericDialect {}),
  }
}

/// Build a connector from a fully-resolved payload (secrets already merged).
pub async fn get_dialect_from_payload(
  DialectPayload {
    connection_id: _,
    dialect,
    path,
    username,
    password,
    database,
    host,
    port,
    cwd,
    uri,
    token,
    disable_ssl,
    ssh_enabled,
    ssh_host,
    ssh_port,
    ssh_username,
    ssh_password,
    ssh_private_key_path,
    ssh_passphrase,
  }: DialectPayload,
) -> Option<Box<dyn Connection>> {
  match dialect.as_str() {
    "folder" => Some(Box::new(FolderConnection {
      path: path.unwrap(),
      cwd,
    })),
    "file" => Some(Box::new(FileConnection {
      path: path.unwrap(),
    })),
    "duckdb" => Some(Box::new(DuckDbConnection {
      path: path.unwrap(),
      cwd,
    })),
    "sqlite" => Some(Box::new(SqliteConnection {
      path: path.unwrap(),
    })),
    "clickhouse" => Some(Box::new(ClickhouseConnection {
      host: host.unwrap(),
      port: port.unwrap_or_default(),
      username: username.unwrap_or_default(),
      password: password.unwrap_or_default(),
      database,
    })),
    "mysql" => {
      let ssh = build_ssh_config(
        ssh_enabled,
        ssh_host.clone(),
        ssh_port.clone(),
        ssh_username.clone(),
        ssh_password.clone(),
        ssh_private_key_path.clone(),
        ssh_passphrase.clone(),
      );
      Some(Box::new(MySqlConnection {
        host: host.unwrap(),
        port: port.unwrap(),
        username: username.unwrap_or_default(),
        password: password.unwrap_or_default(),
        database,
        ssh,
      }))
    }
    "postgres" => {
      let ssh = build_ssh_config(
        ssh_enabled,
        ssh_host,
        ssh_port,
        ssh_username,
        ssh_password,
        ssh_private_key_path,
        ssh_passphrase,
      );
      Some(Box::new(PostgresConnection {
        host: host.unwrap(),
        port: port.unwrap(),
        username: username.unwrap_or_default(),
        password: password.unwrap_or_default(),
        database,
        ssh,
      }))
    }
    "quack" => Some(Box::new(QuackConnection {
      uri: uri.unwrap(),
      token,
      disable_ssl: disable_ssl.unwrap_or(false),
    })),
    // _ => Err("not support dialect".to_string()),
    _ => None,
  }
}

async fn resolve_connection(
  registry: &ConnectionRegistry,
  dialect: DialectPayload,
) -> Result<Box<dyn Connection>, String> {
  let resolved = connection_registry::resolve_payload(registry, dialect)?;
  get_dialect_from_payload(resolved)
    .await
    .ok_or_else(|| "not support dialect".to_string())
}

#[tauri::command]
pub async fn query(
  registry: State<'_, ConnectionRegistry>,
  sql: String,
  limit: usize,
  offset: usize,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  let d = resolve_connection(&registry, dialect).await?;
  let start = Instant::now();
  let res = d.query(&sql, limit, offset).await;
  let duration = start.elapsed().as_millis();
  Ok(ArrowResponse::from_raw_data(res, Some(duration)))
}

#[tauri::command]
pub async fn paging_query(
  registry: State<'_, ConnectionRegistry>,
  sql: String,
  limit: usize,
  offset: usize,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  let d = resolve_connection(&registry, dialect).await?;
  let start = Instant::now();
  let res = d.paging_query(&sql, Some(limit), Some(offset)).await;
  let duration = start.elapsed().as_millis();
  Ok(ArrowResponse::from_raw_data(res, Some(duration)))
}

#[tauri::command]
pub async fn query_table(
  registry: State<'_, ConnectionRegistry>,
  table: &str,
  limit: usize,
  offset: usize,
  #[allow(non_snake_case)] orderBy: Option<String>,
  r#where: Option<String>,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  let d = resolve_connection(&registry, dialect).await?;

  let start = Instant::now();
  let res = d
    .query_table(
      table,
      limit,
      offset,
      &r#where.clone().unwrap_or_default(),
      &orderBy.clone().unwrap_or_default(),
    )
    .await;
  let duration = start.elapsed().as_millis();
  Ok(ArrowResponse::from_raw_data(res, Some(duration)))
}

#[tauri::command]
pub async fn table_row_count(
  registry: State<'_, ConnectionRegistry>,
  table: &str,
  condition: &str,
  dialect: DialectPayload,
) -> Result<usize, String> {
  let d = resolve_connection(&registry, dialect).await?;
  d.table_row_count(table, condition)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export(
  registry: State<'_, ConnectionRegistry>,
  sql: String,
  file: String,
  format: Option<String>,
  options: Option<connector::utils::ExportOptions>,
  dialect: DialectPayload,
) -> Result<(), String> {
  let d = resolve_connection(&registry, dialect).await?;
  let format = if let Some(format) = format {
    format
  } else {
    file.split('.').next_back().unwrap_or("csv").to_string()
  };
  let options = options.unwrap_or_default();
  d.export(&sql, &file, &format, &options)
    .await
    .map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub async fn opened_files(state: State<'_, OpenedFiles>) -> Result<Vec<String>, String> {
  Ok(if let Some(files) = &*state.0.lock().unwrap() {
    files.to_vec()
  } else {
    vec![]
  })
}

#[tauri::command]
pub async fn get_db(
  registry: State<'_, ConnectionRegistry>,
  dialect: DialectPayload,
) -> Result<TreeNode, String> {
  let d = resolve_connection(&registry, dialect).await?;
  d.get_db().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn show_schema(
  registry: State<'_, ConnectionRegistry>,
  schema: &str,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  let d = resolve_connection(&registry, dialect).await?;
  let res = d.show_schema(schema).await;
  Ok(ArrowResponse::from_raw_data(res, None))
}

#[tauri::command]
pub async fn show_column(
  registry: State<'_, ConnectionRegistry>,
  schema: Option<&str>,
  table: &str,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  let d = resolve_connection(&registry, dialect).await?;
  let res = d.show_column(schema, table).await;
  Ok(ArrowResponse::from_raw_data(res, None))
}

#[tauri::command]
pub async fn drop_table(
  registry: State<'_, ConnectionRegistry>,
  schema: Option<&str>,
  table: &str,
  dialect: DialectPayload,
) -> Result<String, String> {
  let d = resolve_connection(&registry, dialect).await?;
  // TODO: ERROR INFO
  let res = d.drop_table(schema, table).await.expect("ERROR");
  Ok(res)
}

#[tauri::command]
pub async fn format_sql(sql: &str) -> Result<String, String> {
  let params = QueryParams::default();
  let options = FormatOptions::default();
  Ok(sqlformat::format(sql, &params, &options))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SqlfmtCheckResult {
  pub available: bool,
  pub path: String,
  pub version: Option<String>,
  pub error: Option<String>,
}

fn resolve_sqlfmt_bin(path: Option<&str>) -> String {
  path
    .map(str::trim)
    .filter(|p| !p.is_empty())
    .unwrap_or("sqlfmt")
    .to_string()
}

fn configure_no_window(cmd: &mut Command) {
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
  }
}

/// Check whether `sqlfmt` (shandy-sqlfmt) is available on PATH or at a custom path.
#[tauri::command]
pub async fn check_sqlfmt(path: Option<String>) -> SqlfmtCheckResult {
  let bin = resolve_sqlfmt_bin(path.as_deref());
  let mut cmd = Command::new(&bin);
  cmd.arg("--version");
  cmd.stdout(Stdio::piped());
  cmd.stderr(Stdio::piped());
  configure_no_window(&mut cmd);

  match cmd.output() {
    Ok(output) if output.status.success() => {
      let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
      let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
      let version = if !stdout.is_empty() {
        Some(stdout)
      } else if !stderr.is_empty() {
        Some(stderr)
      } else {
        Some("ok".to_string())
      };
      SqlfmtCheckResult {
        available: true,
        path: bin,
        version,
        error: None,
      }
    }
    Ok(output) => {
      let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
      let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
      let detail = if !stderr.is_empty() {
        stderr
      } else if !stdout.is_empty() {
        stdout
      } else {
        format!("exit code {}", output.status)
      };
      SqlfmtCheckResult {
        available: false,
        path: bin,
        version: None,
        error: Some(detail),
      }
    }
    Err(err) => SqlfmtCheckResult {
      available: false,
      path: bin,
      version: None,
      error: Some(err.to_string()),
    },
  }
}

/// Format SQL via external `sqlfmt` (`echo SQL | sqlfmt -`).
#[tauri::command]
pub async fn format_sql_sqlfmt(
  sql: String,
  path: Option<String>,
  line_length: Option<u32>,
  dialect: Option<String>,
) -> Result<String, String> {
  let bin = resolve_sqlfmt_bin(path.as_deref());
  let mut cmd = Command::new(&bin);
  if let Some(len) = line_length {
    cmd.arg("--line-length").arg(len.to_string());
  }
  if let Some(d) = dialect
    .as_deref()
    .map(str::trim)
    .filter(|d| !d.is_empty() && *d != "polyglot")
  {
    cmd.arg("--dialect").arg(d);
  }
  cmd.arg("-");
  cmd.stdin(Stdio::piped());
  cmd.stdout(Stdio::piped());
  cmd.stderr(Stdio::piped());
  configure_no_window(&mut cmd);

  let mut child = cmd
    .spawn()
    .map_err(|e| format!("failed to start `{bin}`: {e}"))?;

  {
    let mut stdin = child
      .stdin
      .take()
      .ok_or_else(|| format!("failed to open stdin for `{bin}`"))?;
    stdin
      .write_all(sql.as_bytes())
      .map_err(|e| format!("failed to write SQL to `{bin}`: {e}"))?;
  }

  let output = child
    .wait_with_output()
    .map_err(|e| format!("failed to wait for `{bin}`: {e}"))?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let detail = if !stderr.is_empty() {
      stderr
    } else if !stdout.is_empty() {
      stdout
    } else {
      format!("exit code {}", output.status)
    };
    return Err(format!("`{bin}` failed: {detail}"));
  }

  String::from_utf8(output.stdout).map_err(|e| format!("invalid utf-8 from `{bin}`: {e}"))
}

#[tauri::command]
pub async fn find(
  registry: State<'_, ConnectionRegistry>,
  value: &str,
  path: &str,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  let d = resolve_connection(&registry, dialect).await?;
  let res = d.find(value, path).await;
  Ok(ArrowResponse::from_raw_data(res, None))
}

#[tauri::command]
pub async fn all_columns(
  registry: State<'_, ConnectionRegistry>,
  dialect: DialectPayload,
) -> Result<Vec<Metadata>, String> {
  let d = resolve_connection(&registry, dialect).await?;
  let s = d.all_columns().await;
  s.map_err(|e| format!("not support dialect {}", e))
}

#[tauri::command]
pub async fn list_ssh_config_hosts() -> Vec<connector::ssh_config::SshConfigHost> {
  connector::ssh_config::list_ssh_config_hosts()
}

#[tauri::command]
pub async fn list_sql_dir(path: &str) -> Result<TreeNode, String> {
  let p = Path::new(path);
  if !p.exists() {
    return Err(format!("the path does not exist: {path}"));
  }
  connector::dialect::folder::sql_directory_tree(p)
    .ok_or_else(|| format!("unable to list sql directory: {path}"))
}

#[tauri::command]
pub async fn read_text_file(path: &str) -> Result<String, String> {
  let p = Path::new(path);
  if !p.is_file() {
    return Err(format!("not a file: {path}"));
  }
  std::fs::read_to_string(p).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_text_file(path: &str, contents: String) -> Result<(), String> {
  let p = Path::new(path);
  if let Some(parent) = p.parent() {
    if !parent.as_os_str().is_empty() {
      std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
  }
  std::fs::write(p, contents).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_path(path: &str) -> Result<(), String> {
  let _path = Path::new(path);

  // 确保路径存在
  if !_path.exists() {
    return Err(format!("the path does not exist: {}", path).into());
  }

  if _path.is_file() && _path.exists() {
    #[cfg(target_os = "windows")]
    {
      let cmd = format!("/select,{}", path.replace("/", "\\"));
      log::info!("command: {}", cmd);
      Command::new("explorer")
        .arg(cmd)
        .status()
        .expect("Failed to open file explorer");
      return Ok(());
    }
  }

  // 如果是文件，就取父目录；否则直接使用原路径
  let to_open = if _path.is_file() {
    _path
      .parent()
      .ok_or_else(|| format!("unable to obtain the parent directory: {}", path))
      .expect("Failed to get parent directory")
  } else {
    _path
  };

  match open::that(to_open) {
    Ok(()) => log::info!("Opened '{}' successfully.", path),
    Err(err) => log::warn!("An error occurred when opening '{}': {}", path, err),
  }
  Ok(())
}

/// Open the app data directory that holds local config files (e.g. settings.json).
#[tauri::command]
pub async fn open_settings_dir(app: tauri::AppHandle) -> Result<String, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?;

  if !dir.exists() {
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  }

  let path = dir.to_string_lossy().to_string();
  open::that(&dir).map_err(|e| format!("failed to open settings folder: {e}"))?;
  log::info!("Opened settings dir: {path}");
  Ok(path)
}

/// Official GitHub releases endpoint (default).
const UPDATER_ENDPOINT_OFFICIAL: &str =
  "https://github.com/l1xnan/duckling/releases/latest/download/latest.json";

/// China mainland mirror via gh-proxy.
const UPDATER_ENDPOINT_CHINA: &str =
  "https://gh-proxy.com/github.com/l1xnan/duckling/releases/latest/download/latest.json";

fn updater_endpoint_for_source(source: Option<&str>) -> &'static str {
  match source.map(str::trim).unwrap_or("official") {
    "china" | "mirror" => UPDATER_ENDPOINT_CHINA,
    _ => UPDATER_ENDPOINT_OFFICIAL,
  }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateMetadata {
  pub rid: tauri::ResourceId,
  pub current_version: String,
  pub version: String,
  pub date: Option<String>,
  pub body: Option<String>,
  pub raw_json: serde_json::Value,
}

/// Check for updates using a selected endpoint source (`official` | `china`).
///
/// Returns the same metadata shape as `plugin:updater|check` so the frontend can
/// construct `@tauri-apps/plugin-updater`'s `Update` and call `downloadAndInstall`.
#[cfg(desktop)]
#[tauri::command]
pub async fn check_app_update(
  app: tauri::AppHandle,
  webview: tauri::Webview,
  source: Option<String>,
  proxy: Option<String>,
) -> Result<Option<AppUpdateMetadata>, String> {
  let endpoint = url::Url::parse(updater_endpoint_for_source(source.as_deref()))
    .map_err(|e| format!("invalid updater endpoint: {e}"))?;

  let mut builder = app
    .updater_builder()
    .endpoints(vec![endpoint])
    .map_err(|e| e.to_string())?;

  if let Some(proxy_url) = proxy
    .as_deref()
    .map(str::trim)
    .filter(|p| !p.is_empty())
  {
    let proxy = url::Url::parse(proxy_url).map_err(|e| format!("invalid proxy url: {e}"))?;
    builder = builder.proxy(proxy);
  }

  let updater = builder.build().map_err(|e| e.to_string())?;
  let update = updater.check().await.map_err(|e| e.to_string())?;

  let Some(update) = update else {
    return Ok(None);
  };

  let date = update.date.map(|d| d.to_string());
  let metadata = AppUpdateMetadata {
    current_version: update.current_version.clone(),
    version: update.version.clone(),
    date,
    body: update.body.clone(),
    raw_json: update.raw_json.clone(),
    rid: webview.resources_table().add(update),
  };
  Ok(Some(metadata))
}

/// List unique font family names installed on the system.
#[tauri::command]
pub async fn list_system_fonts() -> Result<Vec<String>, String> {
  let mut db = fontdb::Database::new();
  db.load_system_fonts();

  let mut families: Vec<String> = db
    .faces()
    .filter_map(|face| face.families.first().map(|(name, _)| name.clone()))
    .collect();

  families.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
  families.dedup_by(|a, b| a.eq_ignore_ascii_case(b));
  Ok(families)
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::connection_registry::ConnectionRegistry;

  fn block_on<F: std::future::Future>(f: F) -> F::Output {
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
  fn get_ast_dialect_matches_known_names() {
    // Smoke: constructors must not panic for supported dialects.
    let _ = get_ast_dialect("mysql");
    let _ = get_ast_dialect("postgres");
    let _ = get_ast_dialect("duckdb");
    let _ = get_ast_dialect("folder");
    let _ = get_ast_dialect("file");
    let _ = get_ast_dialect("quack");
    let _ = get_ast_dialect("clickhouse");
    let _ = get_ast_dialect("unknown-dialect");
  }

  #[test]
  fn build_ssh_config_disabled_returns_none() {
    assert!(
      build_ssh_config(
        Some(false),
        Some("h".into()),
        Some("22".into()),
        Some("u".into()),
        None,
        None,
        None,
      )
      .is_none()
    );
    assert!(
      build_ssh_config(None, Some("h".into()), None, None, None, None, None).is_none()
    );
  }

  #[test]
  fn build_ssh_config_enabled_defaults_port_22() {
    let cfg = build_ssh_config(
      Some(true),
      Some("bastion".into()),
      None,
      Some("deploy".into()),
      Some("pw".into()),
      Some("/key".into()),
      Some("ph".into()),
    )
    .expect("ssh config");
    assert!(cfg.enabled);
    assert_eq!(cfg.host, "bastion");
    assert_eq!(cfg.port, "22");
    assert_eq!(cfg.username, "deploy");
    assert_eq!(cfg.password.as_deref(), Some("pw"));
    assert_eq!(cfg.private_key_path.as_deref(), Some("/key"));
    assert_eq!(cfg.passphrase.as_deref(), Some("ph"));
  }

  #[test]
  fn dialect_payload_accepts_connection_id_aliases() {
    let camel = r#"{"connectionId":"abc","dialect":"mysql","host":"h","port":"3306"}"#;
    let p: DialectPayload = serde_json::from_str(camel).unwrap();
    assert_eq!(p.connection_id.as_deref(), Some("abc"));
    assert_eq!(p.dialect, "mysql");
    assert_eq!(p.host.as_deref(), Some("h"));

    let snake = r#"{"connection_id":"xyz","dialect":"mysql"}"#;
    let p2: DialectPayload = serde_json::from_str(snake).unwrap();
    assert_eq!(p2.connection_id.as_deref(), Some("xyz"));
  }

  #[test]
  fn dialect_payload_accepts_snake_case_ssh_fields_from_frontend() {
    // Frontend DialectConfig uses snake_case field names.
    let json = r#"{
      "connectionId": "c1",
      "dialect": "mysql",
      "host": "10.0.0.5",
      "port": "3306",
      "username": "root",
      "password": "db-pw",
      "ssh_enabled": true,
      "ssh_host": "bastion",
      "ssh_port": "22",
      "ssh_username": "deploy",
      "ssh_password": "ssh-pw",
      "ssh_private_key_path": "/home/u/.ssh/id_rsa",
      "ssh_passphrase": "ph"
    }"#;
    let p: DialectPayload = serde_json::from_str(json).unwrap();
    assert_eq!(p.connection_id.as_deref(), Some("c1"));
    assert_eq!(p.password.as_deref(), Some("db-pw"));
    assert_eq!(p.ssh_enabled, Some(true));
    assert_eq!(p.ssh_host.as_deref(), Some("bastion"));
    assert_eq!(p.ssh_port.as_deref(), Some("22"));
    assert_eq!(p.ssh_username.as_deref(), Some("deploy"));
    assert_eq!(p.ssh_password.as_deref(), Some("ssh-pw"));
    assert_eq!(
      p.ssh_private_key_path.as_deref(),
      Some("/home/u/.ssh/id_rsa")
    );
    assert_eq!(p.ssh_passphrase.as_deref(), Some("ph"));

    let ssh = build_ssh_config(
      p.ssh_enabled,
      p.ssh_host.clone(),
      p.ssh_port.clone(),
      p.ssh_username.clone(),
      p.ssh_password.clone(),
      p.ssh_private_key_path.clone(),
      p.ssh_passphrase.clone(),
    )
    .expect("ssh should be enabled");
    assert_eq!(ssh.host, "bastion");
    assert_eq!(ssh.password.as_deref(), Some("ssh-pw"));
  }

  #[test]
  fn get_dialect_from_payload_rejects_unknown() {
    let payload = DialectPayload {
      dialect: "not-a-db".into(),
      ..Default::default()
    };
    assert!(block_on(get_dialect_from_payload(payload)).is_none());
  }

  #[test]
  fn get_dialect_from_payload_builds_file_and_sqlite() {
    let file = DialectPayload {
      dialect: "file".into(),
      path: Some("/tmp/a.parquet".into()),
      ..Default::default()
    };
    assert!(block_on(get_dialect_from_payload(file)).is_some());

    let sqlite = DialectPayload {
      dialect: "sqlite".into(),
      path: Some("/tmp/a.db".into()),
      ..Default::default()
    };
    assert!(block_on(get_dialect_from_payload(sqlite)).is_some());
  }

  #[test]
  fn get_dialect_from_payload_builds_network_dialects() {
    for dialect in ["mysql", "postgres", "clickhouse"] {
      let payload = DialectPayload {
        dialect: dialect.into(),
        host: Some("127.0.0.1".into()),
        port: Some(if dialect == "postgres" {
          "5432".into()
        } else if dialect == "clickhouse" {
          "8123".into()
        } else {
          "3306".into()
        }),
        username: Some("u".into()),
        password: Some("p".into()),
        database: Some("d".into()),
        ..Default::default()
      };
      assert!(
        block_on(get_dialect_from_payload(payload)).is_some(),
        "failed for {dialect}"
      );
    }

    let quack = DialectPayload {
      dialect: "quack".into(),
      uri: Some("quack:localhost".into()),
      token: Some("t".into()),
      disable_ssl: Some(true),
      ..Default::default()
    };
    assert!(block_on(get_dialect_from_payload(quack)).is_some());
  }

  #[test]
  fn resolve_connection_uses_registry() {
    let registry = ConnectionRegistry::default();
    {
      let mut map = registry.0.lock().unwrap();
      map.insert(
        "c1".into(),
        DialectPayload {
          connection_id: Some("c1".into()),
          dialect: "sqlite".into(),
          path: Some("/tmp/x.db".into()),
          password: Some("unused-for-sqlite".into()),
          ..Default::default()
        },
      );
    }
    let req = DialectPayload {
      connection_id: Some("c1".into()),
      ..Default::default()
    };
    let conn = block_on(resolve_connection(&registry, req));
    assert!(conn.is_ok());
  }

  #[test]
  fn resolve_connection_missing_id_errors() {
    let registry = ConnectionRegistry::default();
    let req = DialectPayload {
      connection_id: Some("nope".into()),
      ..Default::default()
    };
    let err = match block_on(resolve_connection(&registry, req)) {
      Ok(_) => panic!("expected missing connection error"),
      Err(e) => e,
    };
    assert!(err.contains("not registered"));
  }

  #[test]
  fn resolve_sqlfmt_bin_defaults_and_custom() {
    assert_eq!(resolve_sqlfmt_bin(None), "sqlfmt");
    assert_eq!(resolve_sqlfmt_bin(Some("")), "sqlfmt");
    assert_eq!(resolve_sqlfmt_bin(Some("  ")), "sqlfmt");
    assert_eq!(resolve_sqlfmt_bin(Some(" /usr/bin/sqlfmt ")), "/usr/bin/sqlfmt");
  }

  #[test]
  fn format_sql_roundtrip_smoke() {
    let out = block_on(format_sql("select 1")).unwrap();
    assert!(out.to_lowercase().contains("select"));
  }
}
