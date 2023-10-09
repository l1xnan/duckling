// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}


use duckdb::{params, Connection, Result};

// In your project, we need to keep the arrow version same as the version used in duckdb.
// Refer to https://github.com/wangfenjin/duckdb-rs/issues/92
// You can either:
use duckdb::arrow::record_batch::RecordBatch;
// Or in your Cargo.toml, use * as the version; features can be toggled according to your needs
// arrow = { version = "*", default-features = false, features = ["prettyprint"] }
// Then you can:
// use arrow::record_batch::RecordBatch;

use duckdb::arrow::util::pretty::print_batches;

#[derive(Debug)]
struct Person {
    id: i32,
    name: String,
    data: Option<Vec<u8>>,
}

fn demo() -> Result<()> {
    let conn = Connection::open_in_memory()?;

    conn.execute_batch(
        r"CREATE SEQUENCE seq;
          CREATE TABLE person (
                  id              INTEGER PRIMARY KEY DEFAULT NEXTVAL('seq'),
                  name            TEXT NOT NULL,
                  data            BLOB
                  );
        ")?;

    let me = Person {
        id: 0,
        name: "Steven".to_string(),
        data: None,
    };
    conn.execute(
        "INSERT INTO person (name, data) VALUES (?, ?)",
        params![me.name, me.data],
    )?;

    // query table by rows
    let mut stmt = conn.prepare("SELECT id, name, data FROM person")?;
    let person_iter = stmt.query_map([], |row| {
        Ok(Person {
            id: row.get(0)?,
            name: row.get(1)?,
            data: row.get(2)?,
        })
    })?;

    for person in person_iter {
        let p = person.unwrap();
        println!("ID: {}", p.id);
        println!("Found person {:?}", p);
    }

    // query table by arrow
    let rbs: Vec<RecordBatch> = stmt.query_arrow([])?.collect();
    print_batches(&rbs).unwrap();
    Ok(())
}



fn main() {
    demo();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
