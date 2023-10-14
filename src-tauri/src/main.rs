// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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
#[derive(Debug, serde::Serialize, serde::Deserialize)]
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
    path: path.to_string(),
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
            path: path.display().to_string(),
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

#[tauri::command]
fn greet(name: &str) -> FileNode {
  let tree = directory_tree(name);
  println!("{:#?}", tree);
  tree
}

fn serialize_preview(record: &RecordBatch) -> Result<Vec<u8>, arrow::error::ArrowError> {
  let mut writer = StreamWriter::try_new(Vec::new(), &record.schema())?;
  writer.write(record)?;
  writer.into_inner()
}

#[tauri::command]
async fn read_parquet(path: String, limit: i32, offset: i32) -> ValidationResponse {
  let db = Connection::open_in_memory().unwrap();

  let count_sql = format!("select count(1) from read_parquet('{path}')");

  let total_count: usize = db
    .query_row(count_sql.as_str(), [], |row| row.get(0))
    .unwrap();

  let sql = format!("select * from read_parquet('{path}') limit {limit} offset {offset}");
  let mut stmt = db.prepare(sql.as_str()).unwrap();

  let frames = stmt.query_arrow(duckdb::params![]).unwrap();

  let schema = frames.get_schema();

  let records: Vec<RecordBatch> = frames.collect();

  let row_count = stmt.row_count();
  let record_batch = arrow::compute::concat_batches(&schema, &records).unwrap();

  ValidationResponse {
    row_count,
    total_count,
    preview: serialize_preview(&record_batch).unwrap(),
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
      app.set_menu(menu)?;

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
    .invoke_handler(tauri::generate_handler![greet, read_parquet])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
