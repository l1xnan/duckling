// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
  menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
  Manager,
};
use tauri_plugin_dialog::DialogExt;

mod api;
mod cmd;

use cmd::{get_folder_tree, query, show_tables};

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
