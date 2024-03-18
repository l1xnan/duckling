// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;

use cmd::OpenedUrls;
use std::sync::Mutex;
use tauri::menu::{CheckMenuItem, MenuBuilder, MenuItem, SubmenuBuilder};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_log::{Target, TargetKind};

mod api;
mod cmd;
mod dialect;
mod utils;

fn handle_menu(app: &mut tauri::App) -> tauri::Result<()> {
  let handle = app.handle();
  let file_menu = SubmenuBuilder::new(handle, "File")
    .text("open-file", "Open File")
    .text("open-directory", "Open Directory")
    .separator()
    .text("exit", "Exit")
    .build()?;

  let toggle = MenuItem::new(handle, "Toggle", true, None::<&str>)?;
  let help = CheckMenuItem::new(handle, "Help", true, true, None::<&str>)?;

  let _menu = MenuBuilder::new(app)
    .items(&[&file_menu, &toggle, &help])
    .build()?;
  // app.set_menu(menu)?;

  app.on_menu_event(move |app, event| {
    println!("{:?}", event.id());

    let id = event.id();
    if id == help.id() {
      println!(
        "`check` triggered, do something! is checked? {}",
        help.is_checked().unwrap()
      );

      // open(&self, path, with)
    } else if id == "toggle" {
      println!("toggle triggered!");
    } else if id == "open-directory" {
      let path = app.dialog().file().blocking_pick_folder();
      if let Some(dir) = path {
        let _ = app.emit("open-directory", dir);
      }
    }
  });
  Ok(())
}

fn handle_open_url(app: &mut tauri::App) {
  #[cfg(any(windows, target_os = "linux"))]
  {
    // NOTICE: `args` may include URL protocol (`your-app-protocol://`) or arguments (`--`) if app supports them.
    let mut urls = Vec::new();
    for arg in env::args().skip(1) {
      if let Ok(url) = url::Url::parse(&arg) {
        urls.push(url);
      }
    }

    app.state::<OpenedUrls>().0.lock().unwrap().replace(urls);

    let opened_urls = if let Some(urls) = &*app.state::<OpenedUrls>().0.lock().unwrap() {
      urls
        .iter()
        .map(|u| u.as_str().replace('\\', "\\\\"))
        .collect::<Vec<_>>()
        .join(", ")
    } else {
      String::new()
    };

    log::info!("opened_urls: {}", opened_urls);
  }
}
fn handle_updater(app: &mut tauri::App) -> tauri::Result<()> {
  #[cfg(desktop)]
  app
    .handle()
    .plugin(tauri_plugin_updater::Builder::new().build())?;
  Ok(())
}

fn main() {
  tauri::Builder::default()
    .manage(OpenedUrls(Mutex::default()))
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(
      tauri_plugin_log::Builder::new()
        .target(Target::new(TargetKind::Webview))
        .target(Target::new(TargetKind::Stdout))
        .target(Target::new(TargetKind::LogDir {
          file_name: Some("db".into()),
        }))
        .build(),
    )
    .setup(|app| {
      let _ = handle_menu(app);
      handle_open_url(app);
      let _ = handle_updater(app);

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      cmd::query,
      cmd::paging_query,
      cmd::query_table,
      cmd::opened_urls,
      cmd::get_db,
      cmd::export,
      cmd::table_row_count,
      cmd::show_schema,
      cmd::show_column,
      cmd::drop_table,
      cmd::format_sql,
    ])
    .build(tauri::generate_context!())
    .expect("error while running tauri application")
    .run(
      #[allow(unused_variables)]
      |app, event| {
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let tauri::RunEvent::Opened { urls } = event {
          if let Some(w) = app.get_webview_window("main") {
            let urls = urls
              .iter()
              .map(|u| u.as_str())
              .collect::<Vec<_>>()
              .join(",");
            let _ = w.eval(&format!("window.onFileOpen(`{urls}`)"));
          }

          app.state::<OpenedUrls>().0.lock().unwrap().replace(urls);
        }
      },
    );
}
