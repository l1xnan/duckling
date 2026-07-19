// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;

use cmd::{ConnectionRegistry, OpenedFiles, SessionManager};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Emitter;
use tauri::menu::{CheckMenuItem, MenuBuilder, MenuItem, SubmenuBuilder};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_log::{Target, TargetKind};

mod api;
mod cmd;

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
      if let Some(FilePath::Path(d)) = path {
        let _ = app.emit("open-directory", d);
      }
    }
  });
  Ok(())
}

fn handle_open_files(app: &mut tauri::App) {
  let mut files = Vec::new();

  // NOTICE: `args` may include URL protocol (`your-app-protocol://`)
  // or arguments (`--`) if your app supports them.
  // files may aslo be passed as `file://path/to/file`
  for maybe_file in std::env::args().skip(1) {
    log::info!("maybe_file: {:?}", maybe_file);

    // skip flags like -f or --flag
    if maybe_file.starts_with('-') {
      continue;
    }

    // handle `file://` path urls and skip other urls
    if let Ok(url) = url::Url::parse(&maybe_file)
      && let Ok(path) = url.to_file_path()
    {
      files.push(path);
      continue;
    }
    files.push(PathBuf::from(maybe_file));

    log::info!("opened_paths: {:?}", files.clone());
    handle_file_associations(app.handle().clone(), files.clone());
  }
}

fn handle_file_associations(app: AppHandle, files: Vec<PathBuf>) {
  let files = files
    .into_iter()
    .map(|f| f.to_string_lossy().to_string())
    .collect::<Vec<_>>();

  log::info!("opened_files: {:?}", files.clone());
  app.state::<OpenedFiles>().0.lock().unwrap().replace(files);
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
    .manage(OpenedFiles(Mutex::default()))
    .manage(ConnectionRegistry::default())
    .manage(SessionManager::default())
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

      #[cfg(any(windows, target_os = "linux"))]
      handle_open_files(app);

      let _ = handle_updater(app);

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      cmd::db::query,
      cmd::db::paging_query,
      cmd::db::query_table,
      cmd::db::export,
      cmd::db::table_row_count,
      cmd::db::find,
      cmd::db::get_db,
      cmd::db::test_connection,
      cmd::db::show_schema,
      cmd::db::show_column,
      cmd::db::drop_table,
      cmd::db::all_columns,
      cmd::db::connection_capabilities,
      cmd::app::format_sql,
      cmd::app::check_sqlfmt,
      cmd::app::format_sql_sqlfmt,
      cmd::app::opened_files,
      cmd::app::list_sql_dir,
      cmd::app::read_text_file,
      cmd::app::write_text_file,
      cmd::app::open_path,
      cmd::app::list_ssh_config_hosts,
      cmd::app::open_settings_dir,
      cmd::app::list_system_fonts,
      cmd::secret_store::secret_set,
      cmd::secret_store::secret_get,
      cmd::secret_store::secret_delete,
      cmd::secret_store::connections_export_encrypt,
      cmd::secret_store::connections_import_decrypt,
      cmd::connection_registry::register_connection,
      cmd::connection_registry::unregister_connection,
      cmd::connection_registry::sync_connections,
      #[cfg(desktop)]
      cmd::app::check_app_update,
    ])
    .build(tauri::generate_context!())
    .expect("error while running tauri application")
    .run(
      #[allow(unused_variables)]
      |app, event| {
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let tauri::RunEvent::Opened { urls } = event {
          let files = urls
            .into_iter()
            .filter_map(|url| url.to_file_path().ok())
            .collect::<Vec<_>>();
          handle_file_associations(app.clone(), files);
        }
      },
    );
}
