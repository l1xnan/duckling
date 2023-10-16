// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use anyhow::anyhow;

use arrow::{ipc::writer::StreamWriter, record_batch::RecordBatch};
use duckdb::{params, Connection, Result};
use std::fmt::format;
use std::path::Path;
use tauri::{
  menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
  Manager,
};
use tauri_plugin_dialog::DialogExt;

use duckdb::arrow::util::pretty::print_batches;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
struct FileNode {
  name: String,
  path: String,
  is_dir: bool,
  children: Vec<FileNode>,
}

#[derive(Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct ValidationResponse {
  /// The total number of rows that were selected.
  pub row_count: usize,
  pub total_count: usize,
  /// A preview of the first N records, serialized as an Apache Arrow array
  /// using their IPC format.
  pub preview: Vec<u8>,
}

fn directory_tree(path: &str) -> FileNode {
  let mut node = FileNode {
    path: path.to_string().replace("\\", "/"),
    name: Path::new(path)
      .file_name()
      .unwrap()
      .to_string_lossy()
      .to_string(),
    is_dir: Path::new(path).is_dir(),
    children: Vec::new(),
  };

  if let Ok(entries) = fs::read_dir(path) {
    for entry in entries {
      if let Ok(entry) = entry {
        let path = entry.path();
        if path.is_dir() {
          let child_node = directory_tree(path.to_str().unwrap());
          node.children.push(child_node);
        } else {
          node.children.push(FileNode {
            path: path.display().to_string().replace("\\", "/"),
            name: path.file_name().unwrap().to_string_lossy().to_string(),
            is_dir: false,
            children: Vec::new(),
          });
        }
      }
    }
  }

  node
}

fn _show_tables(path: String) -> Result<ValidationResponse> {
  let db = Connection::open(path)?;
  let mut stmt = db.prepare("SHOW TABLES").unwrap();
  let frames = stmt.query_arrow(duckdb::params![]).unwrap();
  let schema = frames.get_schema();
  let records: Vec<RecordBatch> = frames.collect();
  let record_batch = arrow::compute::concat_batches(&schema, &records).unwrap();
  Ok(ValidationResponse {
    row_count: records.len(),
    total_count: records.len(),
    preview: serialize_preview(&record_batch).unwrap(),
  })
}

#[tauri::command]
async fn show_tables(path: String) -> ValidationResponse {
  let res = _show_tables(path);
  if let Ok(data) = res {
    data
  } else {
    ValidationResponse::default()
  }
}

#[tauri::command]
fn get_folder_tree(name: &str) -> FileNode {
  directory_tree(name)
}

fn serialize_preview(record: &RecordBatch) -> Result<Vec<u8>, arrow::error::ArrowError> {
  let mut writer = StreamWriter::try_new(Vec::new(), &record.schema())?;
  writer.write(record)?;
  writer.into_inner()
}

fn _query(sql: String, limit: i32, offset: i32) -> anyhow::Result<ValidationResponse> {
  let db = Connection::open_in_memory()
    .map_err(|err| anyhow!("Failed to open database connection: {}", err))?;

  println!("sql: {}", sql);

  // get total row count
  let count_sql = format!("select count(1) from ({sql})");
  let total_count: usize = db
    .query_row(count_sql.as_str(), [], |row| row.get(0))
    .unwrap();

  // query
  let sql = format!("{sql} limit {limit} offset {offset}");
  let mut stmt = db.prepare(sql.as_str()).unwrap();
  let frames = stmt.query_arrow(duckdb::params![]).unwrap();
  println!("sql: {}", sql);
  let schema = frames.get_schema();
  let records: Vec<RecordBatch> = frames.collect();

  let record_batch = arrow::compute::concat_batches(&schema, &records).unwrap();

  Ok(ValidationResponse {
    row_count: 0,
    total_count,
    preview: serialize_preview(&record_batch).unwrap(),
  })
}

#[tauri::command]
async fn query(sql: String, limit: i32, offset: i32) -> ValidationResponse {
  let res = _query(sql, limit, offset);
  if let Ok(data) = res {
    data
  } else {
    ValidationResponse::default()
  }
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      let file_menu = SubmenuBuilder::new(app, "File")
        .text("open-file", "Open File")
        .text("open-directory", "Open Directory")
        .separator()
        .text("exit", "Exit")
        .build()?;

      let toggle = MenuItemBuilder::with_id("toggle", "Toggle").build(app);
      let help = CheckMenuItemBuilder::new("Help").build(app);

      let menu = MenuBuilder::new(app)
        .items(&[&file_menu, &toggle, &help])
        .build()?;
      // app.set_menu(menu)?;

      app.on_menu_event(move |app, event| {
        println!("{:?}", event.id());

        let id = event.id();
        if event.id() == help.id() {
          println!(
            "`check` triggered, do something! is checked? {}",
            help.is_checked().unwrap()
          );

          // open(&self, path, with)
        } else if event.id() == "toggle" {
          println!("toggle triggered!");
        } else if id == "open-directory" {
          let path = app.dialog().file().blocking_pick_folder();
          if let Some(dir) = path {
            app.emit_all("open-directory", dir);
          }
        }
      });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_folder_tree,
      query,
      show_tables
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
