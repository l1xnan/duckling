use crate::api;
use crate::api::{ArrowResponse, FileNode};

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
