use std::str;
use std::sync::Arc;

use arrow::array::*;
use arrow::datatypes::*;
use async_trait::async_trait;
use chrono::naive::NaiveDate;
use chrono::DateTime;
use chrono_tz::Tz;
use clickhouse_rs::types::{Decimal, FromSql, SqlType};
use clickhouse_rs::ClientHandle;
use clickhouse_rs::{types::column::Column, Block, Pool, Simple};
use futures_util::stream::StreamExt;
use serde::{Deserialize, Serialize};

use crate::api::RawArrowData;
use crate::dialect::{Connection, TreeNode};
use crate::utils::{build_tree, Table};
use crate::utils::{date_to_days, write_csv};

use super::Title;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ClickhouseDialect {
  pub host: String,
  pub port: String,
  pub username: String,
  pub password: String,
  pub database: Option<String>,
}

#[async_trait]
impl Connection for ClickhouseDialect {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let tables = self.get_tables().await?;
    Ok(TreeNode {
      name: self.host.clone(),
      path: self.host.clone(),
      node_type: "root".to_string(),
      children: Some(build_tree(tables)),
      size: None,
      comment: None,
    })
  }

  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<RawArrowData> {
    self.fetch_all(sql).await
  }
  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    self._table_row_count(table, r#where).await
  }

  async fn show_schema(&self, schema: &str) -> anyhow::Result<RawArrowData> {
    let sql = format!(
      "select * from system.tables where database='{}' order by engine, name",
      schema
    );
    self.query(&sql, 0, 0).await
  }

  async fn show_column(&self, schema: Option<&str>, table: &str) -> anyhow::Result<RawArrowData> {
    let (db, tbl) = if schema.is_none() && table.contains(".") {
      let parts: Vec<&str> = table.splitn(2, '.').collect();
      (parts[0], parts[1])
    } else {
      ("", table)
    };
    let sql = format!("select * from system.columns where database='{db}' and table='{tbl}'");
    log::info!("show columns: {}", &sql);
    self.query(&sql, 0, 0).await
  }
}

impl ClickhouseDialect {
  pub(crate) fn get_url(&self) -> String {
    format!(
      "tcp://{}:{}@{}:{}/{}?compression=lz4",
      self.username,
      self.password,
      self.host,
      self.port,
      self.database.clone().unwrap_or_default(),
    )
  }

  async fn client(&self) -> anyhow::Result<ClientHandle> {
    let pool = Pool::new(self.get_url());
    let client = pool.get_handle().await?;
    Ok(client)
  }

  fn get_schema(&self) -> Vec<Table> {
    vec![]
  }
  async fn get_tables(&self) -> anyhow::Result<Vec<Table>> {
    let sql = "
      select database as db_name, name as table_name, engine as table_type,
        if(engine='View', 'view', 'table') as type, total_bytes, comment
      from system.tables order by database, table_type
      ";
    let mut client = self.client().await?;
    let block = client.query(sql).fetch_all().await?;
    let mut tables = Vec::new();
    for row in block.rows() {
      let db_name: String = row.get("db_name")?;
      let table_name: String = row.get("table_name")?;
      let table_type: String = row.get("table_type")?;
      let r#type: String = row.get("type")?;
      let size = row.get::<u64, _>("table_type").ok();

      tables.push(Table {
        db_name,
        table_name,
        table_type,
        r#type,
        schema: None,
        size,
      });
    }
    Ok(tables)
  }

  async fn _table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let mut conn = self.client().await?;
    let sql = self._table_count_sql(table, r#where);
    let block = conn.query(&sql).fetch_all().await?;

    if let Some(row) = block.rows().next() {
      let total = row.get::<u64, _>(0)?;
      return Ok(total.as_usize());
    }
    Err(anyhow::anyhow!("null"))
  }

  async fn export(&self, sql: &str, file: &str) -> anyhow::Result<()> {
    let mut client = self.client().await?;
    let mut stream = client.query(sql).stream_blocks();

    let mut batchs = vec![];
    while let Some(block) = stream.next().await {
      let block = block?;
      let batch = block_to_arrow(&block)?;
      batchs.push(batch);
    }
    let b = batchs[0].clone();
    let schema = b.schema();
    let batch = arrow::compute::concat_batches(&schema, &batchs)?;
    write_csv(file, &batch);
    Ok(())
  }

  async fn fetch_all(&self, sql: &str) -> anyhow::Result<RawArrowData> {
    let pool = Pool::new(self.get_url());
    let mut client = pool.get_handle().await?;
    let mut stream = client.query(sql).stream_blocks();
    let mut titles = vec![];

    let mut batchs = vec![];
    let mut block_count = 0;
    while let Some(block) = stream.next().await {
      let block = block?;

      if block_count == 0 {
        titles = block
          .columns()
          .iter()
          .map(|c| Title {
            name: c.name().to_string(),
            r#type: c.sql_type().to_string().into(),
          })
          .collect();
      }

      block_count += 1;
      let batch = block_to_arrow(&block)?;
      batchs.push(batch);
    }
    let b = batchs[0].clone();
    let schema = b.schema();
    let batch = arrow::compute::concat_batches(&schema, &batchs)?;
    Ok(RawArrowData {
      total: batch.num_rows(),
      batch,
      titles: Some(titles),
      sql: Some(sql.to_string()),
    })
  }

  pub async fn fetch_many(
    &self,
    sql: &str,
    limit: usize,
    offset: usize,
  ) -> anyhow::Result<RawArrowData> {
    let pool = Pool::new(self.get_url());
    let mut client = pool.get_handle().await?;

    let mut stream = client.query(sql).stream_blocks();

    let mut batchs = vec![];

    let mut offset = offset;
    let mut row_count = 0;
    let mut total = 0;

    let mut titles = vec![];
    while let Some(block) = stream.next().await {
      let block = block?;

      if total == 0 {
        titles = block
          .columns()
          .iter()
          .map(|c| Title {
            name: c.name().to_string(),
            r#type: c.sql_type().to_string().into(),
          })
          .collect();
      }

      let count = block.row_count();
      total += count;
      if (offset as i64 - count as i64) >= 0 {
        offset -= count;
        continue;
      }
      let batch = block_to_arrow(&block)?;
      batchs.push(batch);
      row_count += count;
      if row_count >= limit + offset {
        break;
      }
    }
    let b = batchs[0].clone();
    let schema = b.schema();
    let batch = arrow::compute::concat_batches(&schema, &batchs)?;
    let total = batch.num_rows();

    let batch = batch.slice(offset, std::cmp::min(limit, total - offset));

    Ok(RawArrowData {
      total,
      batch,
      titles: Some(titles),
      sql: Some(sql.to_string()),
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
    SqlType::Nullable(t) => convert_type(*t),
    SqlType::Decimal(_d1, _d2) => DataType::Utf8,
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

macro_rules! generate_array {
  ($block:expr, $col:expr, $ty:ty, $nav:ty, $nullable:expr) => {
    if $nullable {
      Arc::new(<$ty>::from(collect_block::<Option<$nav>>(
        $block,
        $col.name(),
      ))) as ArrayRef
    } else {
      Arc::new(<$ty>::from(collect_block::<$nav>($block, $col.name()))) as ArrayRef
    }
  };
}

fn collect_block<'b, T: FromSql<'b>>(block: &'b Block, column: &str) -> Vec<T> {
  (0..block.row_count())
    .map(|i| block.get(i, column).unwrap())
    .collect()
}

fn convert_col(
  block: &Block,
  col_type: &SqlType,
  col: &Column<Simple>,
) -> anyhow::Result<(Field, ArrayRef)> {
  let nullable = matches!(col_type, SqlType::Nullable(_));
  let typ = if let SqlType::Nullable(t) = col_type {
    *t
  } else {
    col_type
  };
  let field = Field::new(col.name(), convert_type(typ), nullable);
  let arr: ArrayRef = match typ {
    SqlType::UInt8 => {
      if nullable {
        Arc::new(UInt8Array::from(collect_block::<Option<u8>>(
          block,
          col.name(),
        ))) as ArrayRef
      } else {
        Arc::new(UInt8Array::from(collect_block::<u8>(block, col.name()))) as ArrayRef
      }
    }
    SqlType::UInt16 => generate_array!(block, col, UInt16Array, u16, nullable),
    SqlType::UInt32 => generate_array!(block, col, UInt32Array, u32, nullable),
    SqlType::UInt64 => generate_array!(block, col, UInt64Array, u64, nullable),
    SqlType::Int8 => generate_array!(block, col, Int8Array, i8, nullable),
    SqlType::Int16 => generate_array!(block, col, Int16Array, i16, nullable),
    SqlType::Int32 => generate_array!(block, col, Int32Array, i32, nullable),
    SqlType::Int64 => generate_array!(block, col, Int64Array, i64, nullable),
    SqlType::Float32 => generate_array!(block, col, Float32Array, f32, nullable),
    SqlType::Float64 => generate_array!(block, col, Float64Array, f64, nullable),
    SqlType::Date => {
      if nullable {
        let res: Vec<_> = collect_block::<Option<NaiveDate>>(block, col.name())
          .iter()
          .map(|tt| tt.as_ref().map(date_to_days))
          .collect::<Vec<Option<i32>>>();
        Arc::new(Date32Array::from(res)) as ArrayRef
      } else {
        let res: Vec<_> = collect_block::<NaiveDate>(block, col.name())
          .iter()
          .map(date_to_days)
          .collect::<Vec<i32>>();
        Arc::new(Date32Array::from(res)) as ArrayRef
      }
    }
    SqlType::DateTime(_) => {
      if nullable {
        let res = collect_block::<Option<DateTime<Tz>>>(block, col.name());
        let res = res
          .iter()
          .map(|t| t.map(|i| i.timestamp() * 1000))
          .collect::<Vec<Option<i64>>>();
        Arc::new(Date64Array::from(res)) as ArrayRef
      } else {
        let res = collect_block::<DateTime<Tz>>(block, col.name());
        let res = res
          .iter()
          .map(|t| t.timestamp() * 1000)
          .collect::<Vec<i64>>();
        Arc::new(Date64Array::from(res)) as ArrayRef
      }
    }
    SqlType::Decimal(_d1, _d2) => {
      if nullable {
        Arc::new(StringArray::from(
          col
            .iter::<Option<Decimal>>()?
            .collect::<Vec<_>>()
            .into_iter()
            .map(|t| t.map(|i| format!("{i}")))
            .clone()
            .collect::<Vec<_>>(),
        )) as ArrayRef
      } else {
        Arc::new(StringArray::from(
          col
            .iter::<Decimal>()?
            .collect::<Vec<_>>()
            .into_iter()
            .map(|t| format!("{t}"))
            .clone()
            .collect::<Vec<_>>(),
        )) as ArrayRef
      }
    }
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

fn block_to_arrow(block: &Block) -> anyhow::Result<RecordBatch> {
  let mut fields = vec![];
  let mut data = vec![];
  for col in block.columns() {
    if let Ok((field, arr)) = convert_col(block, &col.sql_type(), col) {
      fields.push(field);
      data.push(arr);
    }
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
