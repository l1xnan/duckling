use log::info;
use std::sync::Mutex;

use crate::api::{ArrowResponse, FileNode};
use crate::dialect::duckdb::DuckDbDialect;
use crate::dialect::file::FileDialect;
use crate::dialect::{folder, Dialect, FolderDialect, TreeNode};
use crate::{api, dialect};
use tauri::State;

pub struct OpenedUrls(pub Mutex<Option<Vec<url::Url>>>);

#[tauri::command]
pub async fn get_folder_tree(name: &str) -> Result<Option<FileNode>, ()> {
  let tree = api::directory_tree(name);
  Ok(tree)
}

#[tauri::command]
pub async fn show_tables(path: String) -> ArrowResponse {
  let res = dialect::sql::show_tables(path);
  api::convert(res)
}

#[tauri::command]
pub async fn query(
  path: String,
  sql: String,
  limit: i32,
  offset: i32,
  // current working directory
  cwd: Option<String>,
) -> ArrowResponse {
  let res = api::query(path.as_str(), sql, limit, offset, cwd);
  api::convert(res)
}

#[tauri::command]
pub async fn opened_urls(state: State<'_, OpenedUrls>) -> Result<String, String> {
  let opened_urls = if let Some(urls) = &*state.0.lock().unwrap() {
    urls
      .iter()
      .map(|u| u.as_str().replace("\\", "\\\\"))
      .collect::<Vec<_>>()
      .join(", ")
  } else {
    "".into()
  };
  Ok(opened_urls)
}

#[tauri::command]
pub async fn get_db(url: &str, dialect: &str) -> Result<Option<TreeNode>, String> {
  if dialect == "folder" {
    let d = FolderDialect {
      path: String::from(url),
    };
    Ok(d.get_db())
  } else if dialect == "file" {
    let d = FileDialect {
      path: String::from(url),
    };
    Ok(d.get_db())
  } else if dialect == "duckdb" {
    let d = DuckDbDialect {
      path: String::from(url),
    };
    Ok(d.get_db())
  } else {
    Err("not support dialect".to_string())
  }
}
