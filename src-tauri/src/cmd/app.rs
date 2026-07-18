use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::Mutex;

use serde::Deserialize;
use serde::Serialize;
use sqlformat::{FormatOptions, QueryParams};
use tauri::{Manager, State};
#[cfg(desktop)]
use tauri_plugin_updater::UpdaterExt;

use connector::utils::TreeNode;

pub struct OpenedFiles(pub Mutex<Option<Vec<String>>>);

#[tauri::command]
pub async fn opened_files(state: State<'_, OpenedFiles>) -> Result<Vec<String>, String> {
  Ok(if let Some(files) = &*state.0.lock().unwrap() {
    files.to_vec()
  } else {
    vec![]
  })
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
