use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;

use serde::Deserialize;
use serde::Serialize;
use sqlformat::{FormatOptions, QueryParams};
use tauri::State;

use connector::api;
use connector::api::ArrowResponse;
use connector::dialect::Connection;
use connector::dialect::clickhouse::ClickhouseConnection;
use connector::dialect::duckdb::DuckDbConnection;
use connector::dialect::file::FileConnection;
use connector::dialect::folder::FolderConnection;
use connector::dialect::mysql::MySqlConnection;
use connector::dialect::postgres::PostgresConnection;
use connector::dialect::sqlite::SqliteConnection;
use connector::utils::TreeNode;

pub struct OpenedFiles(pub Mutex<Option<Vec<String>>>);

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
pub fn get_ast_dialect(dialect: &str) -> Box<dyn sqlparser::dialect::Dialect> {
  match dialect {
    "folder" | "file" | "duckdb" => Box::new(sqlparser::dialect::DuckDbDialect {}),
    "clickhouse" => Box::new(sqlparser::dialect::ClickHouseDialect {}),
    "mysql" => Box::new(sqlparser::dialect::MySqlDialect {}),
    "postgres" => Box::new(sqlparser::dialect::PostgreSqlDialect {}),
    _ => Box::new(sqlparser::dialect::GenericDialect {}),
  }
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
    "folder" => Some(Box::new(FolderConnection {
      path: path.unwrap(),
      cwd,
    })),
    "file" => Some(Box::new(FileConnection {
      path: path.unwrap(),
    })),
    "duckdb" => Some(Box::new(DuckDbConnection {
      path: path.unwrap(),
      cwd,
    })),
    "sqlite" => Some(Box::new(SqliteConnection {
      path: path.unwrap(),
    })),
    "clickhouse" => Some(Box::new(ClickhouseConnection {
      host: host.unwrap(),
      port: port.unwrap(),
      username: username.unwrap_or_default(),
      password: password.unwrap_or_default(),
      database,
    })),
    "mysql" => Some(Box::new(MySqlConnection {
      host: host.unwrap(),
      port: port.unwrap(),
      username: username.unwrap_or_default(),
      password: password.unwrap_or_default(),
      database,
    })),
    "postgres" => Some(Box::new(PostgresConnection {
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
pub async fn query(
  sql: String,
  limit: usize,
  offset: usize,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  if let Some(d) = get_dialect(dialect).await {
    let start = Instant::now();
    let res = d.query(&sql, limit, offset).await;
    let duration = start.elapsed().as_millis();
    Ok(api::convert(res, Some(duration)))
  } else {
    Err("not support dialect".to_string())
  }
}

#[tauri::command]
pub async fn paging_query(
  sql: String,
  limit: usize,
  offset: usize,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  if let Some(d) = get_dialect(dialect).await {
    let start = Instant::now();
    let res = d.paging_query(&sql, Some(limit), Some(offset)).await;
    let duration = start.elapsed().as_millis();
    Ok(api::convert(res, Some(duration)))
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

  let start = Instant::now();
  let res = d
    .query_table(
      table,
      limit,
      offset,
      &r#where.clone().unwrap_or_default(),
      &orderBy.clone().unwrap_or_default(),
    )
    .await;
  let duration = start.elapsed().as_millis();
  Ok(api::convert(res, Some(duration)))
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
pub async fn opened_files(state: State<'_, OpenedFiles>) -> Result<Vec<String>, String> {
  Ok(if let Some(files) = &*state.0.lock().unwrap() {
    files.to_vec()
  } else {
    vec![]
  })
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

  Ok(api::convert(res, None))
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

  Ok(api::convert(res, None))
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

#[tauri::command]
pub async fn format_sql(sql: &str) -> Result<String, String> {
  let params = QueryParams::default();
  let options = FormatOptions::default();
  Ok(sqlformat::format(sql, &params, &options))
}

#[tauri::command]
pub async fn find(
  value: &str,
  path: &str,
  dialect: DialectPayload,
) -> Result<ArrowResponse, String> {
  let d = get_dialect(dialect.clone())
    .await
    .ok_or_else(|| format!("not support dialect {}", dialect.dialect))?;
  let res = d.find(value, path).await;

  Ok(api::convert(res, None))
}
