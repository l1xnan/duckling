use std::sync::Arc;

use arrow::array::*;
use arrow::datatypes::*;
use async_trait::async_trait;
use futures_util::TryStreamExt;
use sqlx::mysql::{MySql, MySqlPool, MySqlRow, MySqlTypeInfo};
use sqlx::types::chrono::{NaiveDate, NaiveDateTime};
use sqlx::{Column, ConnectOptions, Connection, Database, Executor, Row, TypeInfo};

use crate::api::{serialize_preview, ArrowData};
use crate::dialect::{Dialect, TreeNode};
use crate::utils::{build_tree, date_to_days, new_conn, Table};

#[derive(Debug, Default)]
pub struct MySqlDialect {
  pub host: String,
  pub port: String,
  pub username: String,
  pub password: String,
  pub database: Option<String>,
}

#[async_trait]
impl Dialect for MySqlDialect {
  async fn get_db(&self) -> Option<TreeNode> {
    let url = self.get_url();
    if let Ok(tables) = get_tables(&url).await {
      Some(TreeNode {
        name: self.host.clone(),
        path: self.host.clone(),
        node_type: "root".to_string(),
        children: Some(build_tree(tables)),
      })
    } else {
      None
    }
  }

  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<ArrowData> {
    // let pool = MySqlPool::connect(&self.path).await?;
    let mut conn = new_conn::<MySql>(&self.get_url()).await?;

    let info = conn.describe(sql).await?;
    let columns = info.columns();
    println!("{:?}", columns);
    let mut fields = vec![];
    for (k, col) in columns.iter().enumerate() {
      let typ = convert_type(col.type_info());
      let field = Field::new(col.name(), typ, true);
      fields.push(field);
    }
    let mut cursor = conn.fetch(sql);
    let schema = Schema::new(fields);

    let mut i = 0;
    let mut batchs = vec![];
    while let Some(row) = cursor.try_next().await? {
      let mut arrs = vec![];
      for (k, col) in columns.iter().enumerate() {
        let r = convert_row(&row, k, col.type_info().name());
        arrs.push(r);
      }
      let batch = RecordBatch::try_new(Arc::new(schema.clone()), arrs)?;
      batchs.push(batch);
      i += 1;
    }

    let batch = arrow::compute::concat_batches(&Arc::new(schema), &batchs)?;

    Ok(ArrowData {
      total_count: batch.num_rows(),
      preview: serialize_preview(&batch)?,
    })
  }
}

impl MySqlDialect {
  fn get_url(&self) -> String {
    format!(
      "mysql://{}:{}@{}:{}/{}",
      self.username,
      self.password,
      self.host,
      self.port,
      self.database.clone().unwrap_or_default(),
    )
  }

  async fn get_schema(&self) -> Vec<Table> {
    vec![]
  }
}

pub async fn get_tables(url: &str) -> anyhow::Result<Vec<Table>> {
  let pool = MySqlPool::connect(url).await?;

  let sql = r#"
  SELECT tbl_name, name, type
  FROM sqlite_master
  WHERE type IN ('table', 'view') and name NOT IN ('sqlite_sequence', 'sqlite_stat1')
  "#;
  let rows = sqlx::query(sql).fetch_all(&pool).await?;

  let tables: Vec<Table> = rows
    .iter()
    .map(|r| Table {
      table_name: r.get::<String, _>("name"),
      table_type: r.get::<String, _>("type"),
      table_schema: String::new(),
      r#type: r.get::<String, _>("type"),
    })
    .collect();
  Ok(tables)
}

fn convert_type(col_type: &MySqlTypeInfo) -> DataType {
  match col_type.name() {
    "INTEGER" => DataType::Int64,
    "REAL" | "NUMERIC" => DataType::Float64,
    "BOOLEAN" => DataType::Boolean,
    "DATE" => DataType::Date32,
    "DATETIME" => DataType::Date64,
    "TIME" => DataType::Utf8,
    "BLOB" => DataType::Binary,
    "NULL" => DataType::Null,
    _ => DataType::Utf8,
  }
}

fn convert_row(row: &MySqlRow, k: usize, type_name: &str) -> ArrayRef {
  match type_name {
    "INTEGER" => Arc::new(Int64Array::from(vec![row.try_get::<i64, _>(k).ok()])) as ArrayRef,
    "REAL" | "NUMERIC" => {
      Arc::new(Float64Array::from(vec![row.try_get::<f64, _>(k).ok()])) as ArrayRef
    }
    "BOOLEAN" => Arc::new(BooleanArray::from(vec![row.try_get::<bool, _>(k).ok()])) as ArrayRef,
    "DATE" => {
      let val = row
        .try_get::<NaiveDate, _>(k)
        .ok()
        .map(|d| date_to_days(&d));
      Arc::new(Date32Array::from(vec![val])) as ArrayRef
    }
    "DATETIME" => {
      let val = row
        .try_get::<NaiveDateTime, _>(k)
        .ok()
        .map(|t| t.timestamp() * 1000);
      Arc::new(Date64Array::from(vec![val])) as ArrayRef
    }
    "TEXT" => Arc::new(StringArray::from(vec![row.try_get::<&str, _>(k).ok()])) as ArrayRef,
    "BLOB" => Arc::new(BinaryArray::from_opt_vec(vec![row
      .try_get::<&[u8], _>(k)
      .ok()])) as ArrayRef,
    _ => Arc::new(StringArray::from(vec![row.try_get::<&str, _>(k).ok()])) as ArrayRef,
  }
}
