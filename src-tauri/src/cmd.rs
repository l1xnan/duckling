use std::sync::Mutex;

use tauri::State;
use tauri::Window;

use crate::api::ArrowResponse;
use crate::dialect::clickhouse::ClickhouseDialect;
use crate::dialect::duckdb::DuckDbDialect;
use crate::dialect::file::FileDialect;
use crate::dialect::folder::FolderDialect;
use crate::dialect::sqlite::SqliteDialect;
use crate::dialect::{Dialect, TreeNode};
use crate::{api, dialect};

pub struct OpenedUrls(pub Mutex<Option<Vec<url::Url>>>);

#[tauri::command]
pub async fn show_tables(path: String) -> ArrowResponse {
  let res = dialect::sql::show_tables(path);
  api::convert(res)
}

#[tauri::command]
pub async fn query(
  path: String,
  sql: String,
  limit: usize,
  offset: usize,
  // current working directory
  cwd: Option<String>,
  dialect: &str,
  username: Option<String>,
  password: Option<String>,
  host: Option<String>,
  port: Option<String>,
) -> Result<ArrowResponse, ()> {
  let res = if dialect == "clickhouse" {
    let d = ClickhouseDialect {
      host: host.unwrap(),
      port: port.unwrap(),
      username: username.unwrap_or_default(),
      password: password.unwrap_or_default(),
    };
    d.query(&sql).await
  } else {
    api::query(path.as_str(), sql, limit, offset, cwd)
  };
  Ok(api::convert(res))
}

#[derive(Clone, serde::Serialize)]
struct Payload {
  message: String,
}
#[tauri::command]
pub async fn query_stream(
  window: Window,
  sql: &str,
  dialect: Option<ClickhouseDialect>,
) -> anyhow::Result<()> {
  let d = dialect.unwrap();
  let _ = d.query_stream(window, sql).await;
  Ok(())
}

#[tauri::command]
pub async fn opened_urls(state: State<'_, OpenedUrls>) -> Result<String, String> {
  let opened_urls = if let Some(urls) = &*state.0.lock().unwrap() {
    urls
      .iter()
      .map(|u| u.as_str().replace('\\', "\\\\"))
      .collect::<Vec<_>>()
      .join(", ")
  } else {
    "".into()
  };
  Ok(opened_urls)
}

#[tauri::command]
pub async fn get_db(
  path: Option<&str>,
  dialect: &str,
  username: Option<String>,
  password: Option<String>,
  host: Option<String>,
  port: Option<String>,
) -> Result<Option<TreeNode>, String> {
  if dialect == "folder" {
    let d = FolderDialect {
      path: String::from(path.unwrap()),
    };
    Ok(d.get_db().await)
  } else if dialect == "file" {
    let d = FileDialect {
      path: String::from(path.unwrap()),
    };
    Ok(d.get_db().await)
  } else if dialect == "duckdb" {
    let d = DuckDbDialect {
      path: String::from(path.unwrap()),
      cwd: None,
    };
    Ok(d.get_db().await)
  } else if dialect == "sqlite" {
    let d = SqliteDialect {
      path: String::from(path.unwrap()),
    };
    Ok(d.get_db().await)
  } else if dialect == "clickhouse" {
    let d = ClickhouseDialect {
      host: host.unwrap(),
      port: port.unwrap(),
      username: username.unwrap_or_default(),
      password: password.unwrap_or_default(),
    };
    Ok(d.get_db().await)
  } else {
    Err("not support dialect".to_string())
  }
}
