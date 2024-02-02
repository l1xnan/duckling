use std::sync::Mutex;

use serde::Deserialize;
use serde::Serialize;
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

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct DialectPayload {
  pub dialect: String,
  pub path: Option<String>,
  pub username: Option<String>,
  pub password: Option<String>,
  pub host: Option<String>,
  pub port: Option<String>,
}

pub async fn get_dialect(
  DialectPayload {
    dialect,
    path,
    username,
    password,
    host,
    port,
  }: DialectPayload,
) -> Option<Box<dyn Dialect>> {
  match dialect.as_str() {
    "folder" => Some(Box::new(FolderDialect {
      path: path.unwrap(),
    })),
    "file" => Some(Box::new(FileDialect {
      path: path.unwrap(),
    })),
    "duckdb" => Some(Box::new(DuckDbDialect {
      path: path.unwrap(),
      cwd: None,
    })),
    "sqlite" => Some(Box::new(SqliteDialect {
      path: path.unwrap(),
    })),
    "clickhouse" => Some(Box::new(ClickhouseDialect {
      host: host.unwrap(),
      port: port.unwrap(),
      username: username.unwrap_or_default(),
      password: password.unwrap_or_default(),
    })),
    // _ => Err("not support dialect".to_string()),
    _ => None,
  }
}

#[tauri::command]
pub async fn show_tables(path: String) -> ArrowResponse {
  let res = dialect::sql::show_tables(path);
  api::convert(res)
}

#[tauri::command]
pub async fn execute(
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

#[tauri::command]
pub async fn query(
  path: String,
  sql: String,
  limit: usize,
  offset: usize,

  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  if let Some(d) = get_dialect(dialect).await {
    let res = d.query(&sql).await;
    Ok(api::convert(res))
  } else {
    Err("not support dialect".to_string())
  }
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
  dialect: &str,
  path: Option<String>,
  username: Option<String>,
  password: Option<String>,
  host: Option<String>,
  port: Option<String>,
) -> Result<Option<TreeNode>, String> {
  let payload = DialectPayload {
    dialect: dialect.to_string(),
    path,
    username,
    password,
    host,
    port,
  };

  if let Some(d) = get_dialect(payload).await {
    Ok(d.get_db().await)
  } else {
    Err("not support dialect".to_string())
  }
}
