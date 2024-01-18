use std::sync::Arc;

use arrow::array::*;
use arrow::datatypes::*;
use clickhouse_rs::types::{Complex, SqlType};
use clickhouse_rs::{Block, Pool};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};

use crate::api::{serialize_preview, ArrowData};
use crate::dialect::{Dialect, TreeNode};
use crate::utils::{build_tree, Table};

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ClickhouseDialect {
  pub host: String,
  pub port: String,
  pub username: String,
  pub password: String,
}

impl ClickhouseDialect {
  fn get_url(&self) -> String {
    format!(
      "tcp://{}:{}@{}:{}/temp_database_lxn?compression=lz4&ping_timeout=42ms",
      self.username, self.password, self.host, self.port,
    )
  }
}

impl Dialect for ClickhouseDialect {
  async fn get_db(&self) -> Option<TreeNode> {
    let url = self.get_url();
    if let Ok(tables) = get_tables(url).await {
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
}

impl ClickhouseDialect {
  fn get_schema(&self) -> Vec<Table> {
    vec![]
  }

  pub async fn query(&self, sql: &str) -> anyhow::Result<ArrowData> {
    let pool = Pool::new(self.get_url());
    let mut client = pool.get_handle().await?;

    let block = client.query(sql).fetch_all().await?;

    let batch = block_to_arrow(&block)?;

    Ok(ArrowData {
      total_count: batch.num_rows(),
      preview: serialize_preview(&batch)?,
    })
  }
}

fn convert_type(col_type: &SqlType) -> DataType {
  match col_type {
    SqlType::Bool => DataType::Boolean,
    SqlType::UInt8 => DataType::UInt8,
    SqlType::UInt16 => DataType::UInt16,
    SqlType::UInt32 => DataType::UInt32,
    SqlType::UInt64 => DataType::UInt64,
    SqlType::Int8 => DataType::Int8,
    SqlType::Int16 => DataType::Int16,
    SqlType::Int32 => DataType::Int32,
    SqlType::Int64 => DataType::Int64,
    SqlType::String => DataType::Utf8,
    SqlType::Float32 => DataType::Float32,
    SqlType::Float64 => DataType::Float64,
    SqlType::Date => DataType::Date32,
    SqlType::DateTime(_) => DataType::Date64,
    SqlType::Nullable(t) => convert_type(<&SqlType>::clone(t)),
    SqlType::Decimal(d1, d2) => DataType::Decimal128(*d1, *d2 as i8),
    // SqlType::Array(t) => DataType::List(convert_type(t)),
    // SqlType::Map(d1, d2) => DataType::Decimal(d1, d2),
    _ => DataType::Utf8,
  }
}

fn block_to_arrow(block: &Block<Complex>) -> anyhow::Result<RecordBatch> {
  let mut fields = vec![];
  let mut data = vec![];
  for col in block.columns() {
    println!("name: {:?}, sql_type: {:?}", col.name(), col.sql_type());

    let col_type = col.sql_type();
    let field = Field::new(col.name(), convert_type(&col_type), false);

    fields.push(field);

    // TODO: convert type
    let str_vec: Vec<_> = col.iter::<&[u8]>()?.collect();
    let strings: Vec<_> = str_vec
      .iter()
      .map(|&bytes| String::from_utf8(bytes.to_vec()).unwrap())
      .collect();
    let tmp: ArrayRef = Arc::new(StringArray::from(strings));
    data.push(tmp);
  }

  let schema = Schema::new(fields);
  let batch = RecordBatch::try_new(Arc::new(schema), data)?;

  Ok(batch)
}

async fn query_stream(url: &str, sql: &str) -> anyhow::Result<()> {
  let pool = Pool::new(url);
  let mut client = pool.get_handle().await?;

  let mut stream = client.query(sql).stream_blocks();
  while let Some(block) = stream.next().await {
    let block = block?;

    let columns = block.columns();
    for col in columns {
      println!("name: {:?}, sql_type: {:?}", col.name(), col.sql_type());
    }
  }
  Ok(())
}

async fn get_tables(url: String) -> anyhow::Result<Vec<Table>> {
  let sql = r#"
  select database as table_schema, name as table_name, engine as table_type
  from system.tables order by table_schema, table_type
  "#;
  let pool = Pool::new(url);
  let mut client = pool.get_handle().await?;

  let block = client.query(sql).fetch_all().await?;
  let mut tables = Vec::new();
  for row in block.rows() {
    let table_schema: String = row.get("table_schema")?;
    let table_name: String = row.get("table_name")?;
    let table_type: String = row.get("table_type")?;

    tables.push(Table {
      table_schema: table_schema.clone(),
      table_name,
      table_type: table_type.clone(),
      r#type: String::from(if table_type == "View" {
        "view"
      } else {
        "table"
      }),
    });
  }
  Ok(tables)
}
