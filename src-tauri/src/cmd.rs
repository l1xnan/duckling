use std::sync::Mutex;

use serde::Deserialize;
use serde::Serialize;
use tauri::State;

use crate::api;
use crate::api::ArrowResponse;
use crate::dialect::clickhouse::ClickhouseDialect;
use crate::dialect::duckdb::DuckDbDialect;
use crate::dialect::file::FileDialect;
use crate::dialect::folder::FolderDialect;
use crate::dialect::mysql::MySqlDialect;
use crate::dialect::postgres::PostgresDialect;
use crate::dialect::sqlite::SqliteDialect;
use crate::dialect::{Connection, TreeNode};

pub struct OpenedUrls(pub Mutex<Option<Vec<url::Url>>>);

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct DialectPayload {
  pub dialect: String,
  pub path: Option<String>,
  pub username: Option<String>,
  pub password: Option<String>,
  pub host: Option<String>,
  pub port: Option<String>,
  pub database: Option<String>,
  pub cwd: Option<String>,
}

#[allow(clippy::unused_async)]
pub async fn get_dialect(
  DialectPayload {
    dialect,
    path,
    username,
    password,
    database,
    host,
    port,
    cwd,
  }: DialectPayload,
) -> Option<Box<dyn Connection>> {
  match dialect.as_str() {
    "folder" => Some(Box::new(FolderDialect {
      path: path.unwrap(),
      cwd,
    })),
    "file" => Some(Box::new(FileDialect {
      path: path.unwrap(),
    })),
    "duckdb" => Some(Box::new(DuckDbDialect {
      path: path.unwrap(),
      cwd,
    })),
    "sqlite" => Some(Box::new(SqliteDialect {
      path: path.unwrap(),
    })),
    "clickhouse" => Some(Box::new(ClickhouseDialect {
      host: host.unwrap(),
      port: port.unwrap(),
      username: username.unwrap_or_default(),
      password: password.unwrap_or_default(),
      database,
    })),
    "mysql" => Some(Box::new(MySqlDialect {
      host: host.unwrap(),
      port: port.unwrap(),
      username: username.unwrap_or_default(),
      password: password.unwrap_or_default(),
      database,
    })),
    "postgres" => Some(Box::new(PostgresDialect {
      host: host.unwrap(),
      port: port.unwrap(),
      username: username.unwrap_or_default(),
      password: password.unwrap_or_default(),
      database,
    })),
    // _ => Err("not support dialect".to_string()),
    _ => None,
  }
}

#[tauri::command]
pub async fn show_tables(path: String) -> ArrowResponse {
  unimplemented!()
}

#[tauri::command]
pub async fn query(
  sql: String,
  limit: usize,
  offset: usize,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  if let Some(d) = get_dialect(dialect).await {
    let res = d.query(&sql, limit, offset).await;
    Ok(api::convert(res))
  } else {
    Err("not support dialect".to_string())
  }
}

#[tauri::command]
pub async fn query_table(
  table: &str,
  limit: usize,
  offset: usize,
  #[allow(non_snake_case)] orderBy: Option<String>,
  r#where: Option<String>,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  let d = get_dialect(dialect.clone())
    .await
    .ok_or_else(|| format!("not support dialect {}", dialect.dialect))?;

  let res = d
    .query_table(
      table,
      limit,
      offset,
      &r#where.clone().unwrap_or_default(),
      &orderBy.clone().unwrap_or_default(),
    )
    .await;
  Ok(api::convert(res))
}

#[tauri::command]
pub async fn table_row_count(
  table: &str,
  condition: &str,
  dialect: DialectPayload,
) -> Result<usize, String> {
  if let Some(d) = get_dialect(dialect).await {
    d.table_row_count(table, condition)
      .await
      .map_err(|e| e.to_string())
  } else {
    Err("not support dialect".to_string())
  }
}

#[tauri::command]
pub async fn export(sql: String, file: String, dialect: DialectPayload) -> Result<(), String> {
  if let Some(d) = get_dialect(dialect).await {
    d.export(&sql, &file).await;
    Ok(())
  } else {
    Err("not support dialect".to_string())
  }
}

#[tauri::command]
pub async fn opened_urls(state: State<'_, OpenedUrls>) -> Result<String, String> {
  let opened_urls = if let Some(urls) = &*state.0.lock().unwrap() {
    urls
      .iter()
      .map(|u| u.as_str().replace('\\', "\\\\"))
      .collect::<Vec<_>>()
      .join(", ")
  } else {
    String::new()
  };
  Ok(opened_urls)
}

#[tauri::command]
pub async fn get_db(dialect: DialectPayload) -> Result<TreeNode, String> {
  if let Some(d) = get_dialect(dialect).await {
    d.get_db().await.map_err(|e| e.to_string())
  } else {
    Err("not support dialect".to_string())
  }
}

#[tauri::command]
pub async fn show_schema(schema: &str, dialect: DialectPayload) -> Result<ArrowResponse, String> {
  let d = get_dialect(dialect.clone())
    .await
    .ok_or_else(|| format!("not support dialect {}", dialect.dialect))?;
  let res = d.show_schema(schema).await;

  Ok(api::convert(res))
}

#[tauri::command]
pub async fn show_column(
  schema: Option<&str>,
  table: &str,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  let d = get_dialect(dialect.clone())
    .await
    .ok_or_else(|| format!("not support dialect {}", dialect.dialect))?;
  let res = d.show_column(schema, table).await;

  Ok(api::convert(res))
}

#[tauri::command]
pub async fn drop_table(
  schema: Option<&str>,
  table: &str,
  dialect: DialectPayload,
) -> Result<String, String> {
  let d = get_dialect(dialect.clone())
    .await
    .ok_or_else(|| format!("not support dialect {}", dialect.dialect))?;
  // TODO: ERROR INFO
  let res = d.drop_table(schema, table).await.expect("ERROR");
  Ok(res)
}
