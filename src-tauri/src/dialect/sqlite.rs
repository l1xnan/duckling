use crate::api::{serialize_preview, ArrowData};
use crate::dialect::{Dialect, TreeNode};
use crate::utils::{build_tree, get_file_name, Table};
use arrow::array::*;
use arrow::datatypes::*;
use async_trait::async_trait;
use futures_util::TryStreamExt;
use sqlx::any;
use sqlx::error::DatabaseError;
use sqlx::pool::PoolOptions;
use sqlx::sqlite::SqliteTypeInfo;
use sqlx::sqlite::{SqliteConnectOptions, SqliteError};
use sqlx::sqlite::{SqlitePool, SqliteRow};
use sqlx::ConnectOptions;
use sqlx::Row;
use sqlx::SqliteConnection;
use sqlx::TypeInfo;
use sqlx::{sqlite::Sqlite, Column, Executor};
use sqlx::{Connection, Database, Pool};
use std::env;
use std::error::Error;
use std::sync::Arc;

// Make a new connection
// Ensure [dotenvy] and [env_logger] have been setup
pub async fn new<DB>(path: &str) -> anyhow::Result<DB::Connection>
where
  DB: Database,
{
  Ok(DB::Connection::connect(path).await?)
}

#[derive(Debug, Default)]
pub struct SqliteDialect {
  pub path: String,
}

#[async_trait]
impl Dialect for SqliteDialect {
  async fn get_db(&self) -> Option<TreeNode> {
    let url = self.get_url();
    if let Ok(tables) = get_tables(&url).await {
      let mut tree = build_tree(tables);
      let children = if tree.len() > 0 {
        &tree[0].children
      } else {
        &None
      };
      Some(TreeNode {
        name: get_file_name(&self.path),
        path: self.path.clone(),
        node_type: "root".to_string(),
        children: children.clone(),
      })
    } else {
      None
    }
  }

  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<ArrowData> {
    // let pool = SqlitePool::connect(&self.path).await?;
    let mut conn = new::<Sqlite>(&self.path).await?;

    let info = conn.describe(sql).await?;
    let columns = info.columns();
    println!("{:?}", columns);
    let mut fields = vec![];
    let mut data = vec![];
    for (k, col) in columns.iter().enumerate() {
      let typ = col.type_info();
      let (typ, arr) = convert_type(typ);
      let field = Field::new(col.name(), typ, true);
      fields.push(field);
      data.push(arr);
    }
    let mut cursor = conn.fetch(sql);
    let schema = Schema::new(fields);

    let mut i = 0;
    let mut batchs = vec![];
    while let Some(row) = cursor.try_next().await? {
      let mut arrs = vec![];
      for (k, col) in row.columns().iter().enumerate() {
        let r = convert_row(&row, k);
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

impl SqliteDialect {
  fn get_url(&self) -> String {
    format!("sqlite:{}", self.path)
  }

  async fn get_schema(&self) -> Vec<Table> {
    vec![]
  }
}

pub async fn get_tables(path: &str) -> anyhow::Result<Vec<Table>> {
  let pool = SqlitePool::connect(path).await?;

  let sql = r#"
  SELECT tbl_name, name, type
  FROM sqlite_master WHERE type IN ('table', 'view')
  "#;
  let rows = sqlx::query(sql).fetch_all(&pool).await?;

  let tables: Vec<Table> = rows
    .iter()
    .map(|r| Table {
      table_name: r.get::<String, _>("name"),
      table_type: r.get::<String, _>("type"),
      table_schema: "".to_string(),
      r#type: r.get::<String, _>("type"),
    })
    .collect();
  Ok(tables)
}

fn convert_type(col_type: &SqliteTypeInfo) -> (DataType, ArrayRef) {
  match col_type.name() {
    "INTEGER" => (
      DataType::Int64,
      Arc::new(Int64Array::from(Vec::<i64>::new())) as ArrayRef,
    ),
    "REAL" => (
      DataType::Float64,
      Arc::new(Float64Array::from(Vec::<f64>::new())) as ArrayRef,
    ),
    "BOOLEAN" => (
      DataType::Boolean,
      Arc::new(BooleanArray::from(Vec::<bool>::new())) as ArrayRef,
    ),
    "DATE" => (
      DataType::Date32,
      Arc::new(Date32Array::from(Vec::<i32>::new())) as ArrayRef,
    ),
    "DATETIME" => (
      DataType::Date64,
      Arc::new(Date64Array::from(Vec::<i64>::new())) as ArrayRef,
    ),
    "TIME" => (
      DataType::Utf8,
      Arc::new(StringArray::from(Vec::<String>::new())) as ArrayRef,
    ),
    "NULL" => (
      DataType::Null,
      Arc::new(StringArray::from(Vec::<String>::new())) as ArrayRef,
    ),
    _ => (
      DataType::Utf8,
      Arc::new(StringArray::from(Vec::<String>::new())) as ArrayRef,
    ),
  }
}

fn convert_row(row: &SqliteRow, k: usize) -> ArrayRef {
  match row.column(k).type_info().name() {
    "INTEGER" => Arc::new(Int64Array::from(vec![row.try_get::<i64, _>(k).ok()])) as ArrayRef,
    "REAL" => Arc::new(Float64Array::from(vec![row.try_get::<f64, _>(k).ok()])) as ArrayRef,
    "BOOLEAN" => Arc::new(BooleanArray::from(vec![row.try_get::<bool, _>(k).ok()])) as ArrayRef,
    "DATE" => Arc::new(Date32Array::from(vec![row.try_get::<i32, _>(k).ok()])) as ArrayRef,
    "DATETIME" => Arc::new(Date64Array::from(vec![row.try_get::<i64, _>(k).ok()])) as ArrayRef,
    "TEXT" => Arc::new(StringArray::from(vec![row.try_get::<&str, _>(k).ok()])) as ArrayRef,
    _ => Arc::new(StringArray::from(vec![row.try_get::<&str, _>(k).ok()])) as ArrayRef,
  }
}
