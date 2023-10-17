use log::info;
use std::sync::Mutex;

use crate::api;
use crate::api::{ArrowResponse, FileNode};
use tauri::State;

pub struct OpenedUrls(pub Mutex<Option<Vec<url::Url>>>);

#[tauri::command]
pub fn get_folder_tree(name: &str) -> FileNode {
  api::directory_tree(name)
}

#[tauri::command]
pub async fn show_tables(path: String) -> ArrowResponse {
  let res = api::show_tables(path);
  api::convert(res)
}

#[tauri::command]
pub async fn query(path: String, sql: String, limit: i32, offset: i32) -> ArrowResponse {
  let res = api::query(path.as_str(), sql, limit, offset);
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
