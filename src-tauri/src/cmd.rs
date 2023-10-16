use crate::api;
use crate::api::{FileNode, ValidationResponse};

#[tauri::command]
pub fn get_folder_tree(name: &str) -> FileNode {
  api::directory_tree(name)
}

#[tauri::command]
pub async fn show_tables(path: String) -> ValidationResponse {
  let res = api::show_tables(path);
  if let Ok(data) = res {
    data
  } else {
    ValidationResponse::default()
  }
}

#[tauri::command]
pub async fn query(sql: String, limit: i32, offset: i32) -> ValidationResponse {
  let res = api::query(":memory:", sql, limit, offset);
  if let Ok(data) = res {
    data
  } else {
    ValidationResponse::default()
  }
}
