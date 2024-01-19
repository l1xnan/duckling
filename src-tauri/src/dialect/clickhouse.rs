use std::str::{self};
use std::sync::Arc;

use arrow::array::*;
use arrow::datatypes::*;
use clickhouse_rs::types::{Complex, SqlType};
use clickhouse_rs::{types::column::Column, Block, Pool};
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
    SqlType::Float32 => DataType::Float32,
    SqlType::Float64 => DataType::Float64,
    SqlType::Date => DataType::Date32,
    SqlType::String => DataType::Utf8,
    SqlType::DateTime(_) => DataType::Date64,
    SqlType::Nullable(t) => {
      println!("{}", t);
      let typ = convert_type(t.clone());
      println!("{}", typ);
      DataType::Utf8
    }
    SqlType::Decimal(d1, d2) => DataType::Decimal128(*d1, *d2 as i8),
    SqlType::Array(t) => DataType::List(Arc::new(Field::new("", convert_type(t), false))),
    _ => DataType::Utf8,
  }
}

macro_rules! create_array {
  ($col:expr, $ty:ty, $nav:ty) => {
    Arc::new(<$ty>::from(
      $col
        .iter::<$nav>()?
        .collect::<Vec<_>>()
        .into_iter()
        .copied()
        .collect::<Vec<_>>(),
    )) as ArrayRef
  };
}

fn convert_col(col_type: &SqlType, col: &Column<Complex>) -> anyhow::Result<(Field, ArrayRef)> {
  let nullable = matches!(col_type, SqlType::Nullable(_));
  let typ = if let SqlType::Nullable(t) = col_type {
    t.clone()
  } else {
    col_type
  };
  let field = Field::new(col.name(), convert_type(typ), nullable);
  let arr: ArrayRef = match typ {
    SqlType::UInt8 => {
      create_array!(col, UInt8Array, u8)
    }
    SqlType::UInt16 => Arc::new(UInt16Array::from(
      col
        .iter::<u16>()?
        .collect::<Vec<_>>()
        .into_iter()
        .copied()
        .collect::<Vec<_>>(),
    )) as ArrayRef,
    SqlType::UInt32 => Arc::new(UInt32Array::from(
      col
        .iter::<u32>()?
        .collect::<Vec<_>>()
        .into_iter()
        .copied()
        .collect::<Vec<_>>(),
    )) as ArrayRef,
    SqlType::UInt64 => Arc::new(UInt64Array::from(
      col
        .iter::<u64>()?
        .collect::<Vec<_>>()
        .into_iter()
        .cloned()
        .collect::<Vec<_>>(),
    )) as ArrayRef,
    SqlType::Int8 => Arc::new(Int8Array::from(
      col
        .iter::<i8>()?
        .collect::<Vec<_>>()
        .into_iter()
        .cloned()
        .collect::<Vec<_>>(),
    )) as ArrayRef,
    SqlType::Int16 => Arc::new(Int16Array::from(
      col
        .iter::<i16>()?
        .collect::<Vec<_>>()
        .into_iter()
        .cloned()
        .collect::<Vec<_>>(),
    )) as ArrayRef,
    SqlType::Int32 => Arc::new(Int32Array::from(
      col
        .iter::<i32>()?
        .collect::<Vec<_>>()
        .into_iter()
        .cloned()
        .collect::<Vec<_>>(),
    )) as ArrayRef,
    SqlType::Int64 => Arc::new(Int64Array::from(
      col
        .iter::<i64>()?
        .collect::<Vec<_>>()
        .into_iter()
        .cloned()
        .collect::<Vec<_>>(),
    )) as ArrayRef,
    SqlType::Float32 => Arc::new(Float32Array::from(
      col
        .iter::<f32>()?
        .collect::<Vec<_>>()
        .into_iter()
        .cloned()
        .collect::<Vec<_>>(),
    )) as ArrayRef,
    SqlType::Float64 => Arc::new(Float64Array::from(
      col
        .iter::<f64>()?
        .collect::<Vec<_>>()
        .into_iter()
        .cloned()
        .collect::<Vec<_>>(),
    )) as ArrayRef,
    SqlType::Date => Arc::new(Date32Array::from(
      col
        .iter::<i32>()?
        .collect::<Vec<_>>()
        .into_iter()
        .cloned()
        .collect::<Vec<_>>(),
    )) as ArrayRef,
    SqlType::DateTime(_) => Arc::new(Date64Array::from(
      col
        .iter::<i64>()?
        .collect::<Vec<_>>()
        .into_iter()
        .cloned()
        .collect::<Vec<_>>(),
    )) as ArrayRef,
    SqlType::Decimal(_d1, _d2) => Arc::new(Float64Array::from(
      col
        .iter::<f64>()?
        .collect::<Vec<_>>()
        .into_iter()
        .copied()
        .collect::<Vec<_>>(),
    )) as ArrayRef,
    _ => {
      let strings: Vec<_> = if nullable {
        col
          .iter::<Option<&[u8]>>()?
          .filter_map(|s| {
            if let Some(b) = s {
              str::from_utf8(b).ok()
            } else {
              None
            }
          })
          .collect()
      } else {
        col
          .iter::<&[u8]>()?
          .filter_map(|s| std::str::from_utf8(s).ok())
          .collect()
      };
      Arc::new(StringArray::from(strings)) as ArrayRef
    }
  };
  Ok((field, arr))
}
fn block_to_arrow(block: &Block<Complex>) -> anyhow::Result<RecordBatch> {
  let mut fields = vec![];
  let mut data = vec![];
  for col in block.columns() {
    println!("name: {:?}, sql_type: {:?}", col.name(), col.sql_type());

    if let Ok((field, arr)) = convert_col(&col.sql_type(), col) {
      fields.push(field);
      data.push(arr);
    }
    println!("=====");
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
