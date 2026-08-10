use serde::Serialize;
use tauri::Manager;
#[cfg(desktop)]
use tauri_plugin_updater::UpdaterExt;

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

fn updater_source_uses_mirror(source: Option<&str>) -> bool {
  matches!(source.map(str::trim), Some("china") | Some("mirror"))
}

const GH_PROXY_HOST: &str = "gh-proxy.com";
const MIRRORABLE_GITHUB_HOSTS: &[&str] = &[
  "github.com",
  "api.github.com",
  "objects.githubusercontent.com",
];

/// Rewrite GitHub release/API/CDN asset URLs through gh-proxy.
fn mirror_github_url(url: &url::Url) -> Result<url::Url, String> {
  if url.host_str() == Some(GH_PROXY_HOST) {
    return Ok(url.clone());
  }

  let Some(host) = url.host_str() else {
    return Ok(url.clone());
  };
  if !MIRRORABLE_GITHUB_HOSTS.contains(&host) {
    return Ok(url.clone());
  }

  let path = url.path();
  let mut mirrored = format!("https://{GH_PROXY_HOST}/{host}{path}");
  if let Some(query) = url.query() {
    mirrored.push('?');
    mirrored.push_str(query);
  }
  url::Url::parse(&mirrored).map_err(|e| format!("invalid mirrored url: {e}"))
}

fn is_github_release_asset_api_url(url: &url::Url) -> bool {
  url.host_str() == Some("api.github.com") && url.path().contains("/releases/assets/")
}

#[cfg(desktop)]
fn build_updater_http_client(proxy: Option<&str>) -> Result<reqwest::Client, String> {
  let mut builder = reqwest::Client::builder().user_agent("duckling-updater");
  if let Some(proxy_url) = proxy.filter(|p| !p.trim().is_empty()) {
    builder = builder.proxy(reqwest::Proxy::all(proxy_url).map_err(|e| e.to_string())?);
  }
  builder.build().map_err(|e| e.to_string())
}

/// GitHub `latest.json` may point at release *asset API* URLs. Resolve to
/// `browser_download_url` so mirror mode can proxy a stable `github.com` link
/// instead of following an unproxied redirect chain.
#[cfg(desktop)]
async fn resolve_github_release_asset_url(
  url: &url::Url,
  proxy: Option<&str>,
) -> Result<url::Url, String> {
  if !is_github_release_asset_api_url(url) {
    return Ok(url.clone());
  }

  let fetch_url = mirror_github_url(url)?;
  let client = build_updater_http_client(proxy)?;
  let response = client
    .get(fetch_url)
    .header("Accept", "application/vnd.github+json")
    .send()
    .await
    .map_err(|e| format!("failed to fetch release asset metadata: {e}"))?;

  if !response.status().is_success() {
    return Err(format!(
      "failed to resolve release asset metadata: HTTP {}",
      response.status()
    ));
  }

  let body: serde_json::Value = response
    .json()
    .await
    .map_err(|e| format!("invalid release asset metadata JSON: {e}"))?;

  let download_url = body
    .get("browser_download_url")
    .and_then(|v| v.as_str())
    .ok_or_else(|| "release asset metadata missing browser_download_url".to_string())?;

  url::Url::parse(download_url).map_err(|e| format!("invalid browser_download_url: {e}"))
}

#[cfg(desktop)]
async fn prepare_mirrored_download_url(
  url: &url::Url,
  proxy: Option<&str>,
) -> Result<url::Url, String> {
  let resolved = resolve_github_release_asset_url(url, proxy).await?;
  mirror_github_url(&resolved)
}

#[cfg(desktop)]
async fn prepare_mirrored_urls_in_json(
  mut value: serde_json::Value,
  proxy: Option<&str>,
) -> Result<serde_json::Value, String> {
  let Some(platforms) = value.get_mut("platforms").and_then(|p| p.as_object_mut()) else {
    return Ok(value);
  };

  for platform in platforms.values_mut() {
    let Some(platform_obj) = platform.as_object_mut() else {
      continue;
    };
    let Some(url_str) = platform_obj.get("url").and_then(|u| u.as_str()) else {
      continue;
    };
    let Ok(parsed) = url::Url::parse(url_str) else {
      continue;
    };
    let mirrored = prepare_mirrored_download_url(&parsed, proxy).await?;
    platform_obj.insert(
      "url".to_string(),
      serde_json::Value::String(mirrored.to_string()),
    );
  }

  Ok(value)
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

  let Some(mut update) = update else {
    return Ok(None);
  };

  if updater_source_uses_mirror(source.as_deref()) {
    let proxy_ref = proxy.as_deref().filter(|p| !p.trim().is_empty());
    update.download_url =
      prepare_mirrored_download_url(&update.download_url, proxy_ref).await?;
    update.raw_json = prepare_mirrored_urls_in_json(update.raw_json, proxy_ref).await?;
  }

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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn mirror_github_url_rewrites_release_asset() {
    let original = url::Url::parse(
      "https://github.com/l1xnan/duckling/releases/download/v0.1.0/duckling_0.1.0_x64-setup.exe",
    )
    .unwrap();
    let mirrored = mirror_github_url(&original).unwrap();
    assert_eq!(
      mirrored.as_str(),
      "https://gh-proxy.com/github.com/l1xnan/duckling/releases/download/v0.1.0/duckling_0.1.0_x64-setup.exe"
    );
  }

  #[test]
  fn mirror_github_url_is_idempotent_for_proxy_host() {
    let already = url::Url::parse(
      "https://gh-proxy.com/github.com/l1xnan/duckling/releases/download/v0.1.0/app.exe",
    )
    .unwrap();
    let mirrored = mirror_github_url(&already).unwrap();
    assert_eq!(mirrored, already);
  }

  #[test]
  fn mirror_github_url_rewrites_api_release_asset() {
    let original = url::Url::parse(
      "https://api.github.com/repos/l1xnan/duckling/releases/assets/493984152",
    )
    .unwrap();
    let mirrored = mirror_github_url(&original).unwrap();
    assert_eq!(
      mirrored.as_str(),
      "https://gh-proxy.com/api.github.com/repos/l1xnan/duckling/releases/assets/493984152"
    );
  }

  #[test]
  fn github_release_asset_api_url_detection() {
    let api = url::Url::parse(
      "https://api.github.com/repos/l1xnan/duckling/releases/assets/493984173",
    )
    .unwrap();
    assert!(is_github_release_asset_api_url(&api));

    let direct = url::Url::parse(
      "https://github.com/l1xnan/duckling/releases/download/v0.58.0/Duckling_0.58.0_x64-setup.exe",
    )
    .unwrap();
    assert!(!is_github_release_asset_api_url(&direct));
  }
}
