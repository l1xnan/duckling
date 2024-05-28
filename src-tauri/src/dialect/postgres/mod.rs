use std::fmt::Debug;
use std::sync::Arc;

use anyhow::{anyhow, Context};
use arrow::array::*;
use arrow::datatypes::{ArrowNativeType, DataType, Field, Schema};
use arrow::json::ReaderBuilder;

use async_trait::async_trait;
use futures_util::FutureExt;
use rust_decimal::prelude::*;
use serde_json::Map;
use tokio_postgres::types::{FromSql, Type};
use tokio_postgres::{Client, Column, NoTls, Row};

use crate::api::RawArrowData;
use crate::dialect::Connection;
use crate::utils::{build_tree, Table};
use crate::utils::{Title, TreeNode};

#[derive(Debug, Default)]
pub struct PostgresDialect {
  pub host: String,
  pub port: String,
  pub username: String,
  pub password: String,
  pub database: Option<String>,
}

#[async_trait]
impl Connection for PostgresDialect {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let tables = self.get_all_tables().await?;
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
    self._query(sql, limit, offset).await
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    self._table_row_count(table, r#where).await
  }

  async fn show_schema(&self, schema: &str) -> anyhow::Result<RawArrowData> {
    let sql = format!(
      "
    select * from information_schema.tables
    where table_schema='{schema}'
    order by table_type, table_name
    "
    );

    self.query(&sql, 0, 0).await
  }

  async fn show_column(&self, schema: Option<&str>, table: &str) -> anyhow::Result<RawArrowData> {
    let (_db, tbl) = if schema.is_none() && table.contains('.') {
      let parts: Vec<&str> = table.splitn(2, '.').collect();
      (parts[0], parts[1])
    } else {
      ("", table)
    };
    let sql = format!("select * from information_schema.columns where table_name='{tbl}'");
    log::info!("show columns: {}", &sql);
    self.query(&sql, 0, 0).await
  }

  async fn query_count(&self, sql: &str) -> anyhow::Result<usize> {
    let conn = self.get_conn(&self.database()).await?;
    let row = conn.query_one(sql, &[]).await?;
    let total: u32 = row.get(0);
    Ok(total as usize)
  }
}

impl PostgresDialect {
  fn get_url(&self) -> String {
    format!(
      "host={} port={} user={} password={}",
      self.host, self.port, self.username, self.password,
    )
  }

  async fn get_conn(&self, db: &str) -> anyhow::Result<Client> {
    let db = if db.is_empty() {
      String::new()
    } else {
      format!(" dbname={db}")
    };
    let config = self.get_url() + &db;
    connect(&config).await
  }

  async fn get_schema(&self) -> Vec<Table> {
    unimplemented!()
  }
  pub async fn databases(&self) -> anyhow::Result<Vec<String>> {
    let client = self.get_conn("postgres").await?;
    let sql = "SELECT datname FROM pg_database WHERE datistemplate = false";

    let mut names = vec![];
    for row in client.query(sql, &[]).await? {
      let _name: String = row.get(0);
      names.push(row.get(0));
    }
    Ok(names)
  }
  pub async fn get_tables(&self, db: &str) -> anyhow::Result<Vec<Table>> {
    let client = self.get_conn(db).await?;

    let sql = "
      select
        table_catalog as db_name,
        table_schema as table_schema,
        table_name as table_name,
        table_type as table_type,
        CASE WHEN table_type='BASE TABLE' THEN 'table' ELSE 'view' END as type
      from information_schema.tables WHERE table_schema='public'
      ";
    let mut tables = vec![];
    for row in client.query(sql, &[]).await? {
      tables.push(Table {
        db_name: row.get::<_, String>(0),
        schema: Some(row.get::<_, String>(1)),
        table_name: row.get::<_, String>(2),
        table_type: row.get::<_, String>(3),
        r#type: row.get::<_, String>(4),
        size: None,
      });
    }
    Ok(tables)
  }

  pub async fn get_all_tables(&self) -> anyhow::Result<Vec<Table>> {
    let names = self.databases().await?;
    let mut tables = vec![];

    for db in names {
      tables.extend(self.get_tables(&db).await?);
    }
    Ok(tables)
  }

  async fn _query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    let conn = self.get_conn(&self.database()).await?;

    let stmt = conn.prepare(sql).await?;
    let mut fields = vec![];
    let _k = stmt.columns().len();
    let mut titles = vec![];
    for col in stmt.columns() {
      titles.push(Title {
        name: col.name().to_string(),
        r#type: col.type_().name().to_string(),
      });
      let typ = col_to_arrow_type(col);
      let field = Field::new(col.name(), typ, true);
      fields.push(field);

      println!(
        "{}={}, {}, {:?}",
        col.name(),
        col.type_().name(),
        col.type_().oid(),
        col.type_().kind()
      );
    }
    println!("titles: {titles:?}");
    let schema = Schema::new(fields);

    let mut rows: Vec<RowData> = vec![];
    for row in conn.query(&stmt, &[]).await? {
      let r = postgres_row_to_row_data(row)?;
      rows.push(r);
    }

    let mut decoder = ReaderBuilder::new(Arc::new(schema))
      .build_decoder()
      .unwrap();
    decoder.serialize(&rows)?;
    let batch = decoder.flush()?.unwrap();

    Ok(RawArrowData {
      total: batch.num_rows(),
      batch,
      titles: Some(titles),
      sql: Some(sql.to_string()),
    })
  }

  fn database(&self) -> String {
    self.database.clone().unwrap_or("postgres".to_string())
  }

  async fn _table_row_count(&self, table: &str, cond: &str) -> anyhow::Result<usize> {
    let conn = self.get_conn(&self.database()).await?;
    let sql = self._table_count_sql(table, cond);
    let row = conn.query_one(&sql, &[]).await?;
    let total: u32 = row.get::<_, u32>(0);
    Ok(total.as_usize())
  }
}

async fn connect(s: &str) -> anyhow::Result<Client> {
  let (client, connection) = tokio_postgres::connect(s, NoTls).await?;
  let connection = connection.map(|e| e.unwrap());
  tokio::spawn(connection);
  Ok(client)
}

pub fn postgres_row_to_json_value(row: Row) -> Result<JSONValue, Error> {
  let row_data = postgres_row_to_row_data(row)?;
  Ok(JSONValue::Object(row_data))
}

// some type-aliases I use in my project
pub type JSONValue = serde_json::Value;
pub type RowData = Map<String, JSONValue>;
pub type Error = anyhow::Error; // from: https://github.com/dtolnay/anyhow

pub fn postgres_row_to_row_data(row: Row) -> Result<RowData, Error> {
  let mut result: RowData = Map::new();
  for (i, column) in row.columns().iter().enumerate() {
    let name = column.name();
    let json_value = pg_cell_to_json_value(&row, column, i).unwrap();
    result.insert(name.to_string(), json_value);
  }
  Ok(result)
}

pub fn pg_cell_to_json_value(
  row: &Row,
  column: &Column,
  column_i: usize,
) -> Result<JSONValue, Error> {
  let f64_to_json_number = |raw_val: f64| -> Result<JSONValue, Error> {
    let temp = serde_json::Number::from_f64(raw_val).ok_or(anyhow!("invalid json-float"))?;
    Ok(JSONValue::Number(temp))
  };
  Ok(match *column.type_() {
    // for rust-postgres <> postgres type-mappings: https://docs.rs/postgres/latest/postgres/types/trait.FromSql.html#types
    // for postgres types: https://www.postgresql.org/docs/7.4/datatype.html#DATATYPE-TABLE

    // single types
    Type::BOOL => get_basic(row, column, column_i, |a: bool| Ok(JSONValue::Bool(a)))?,
    Type::INT2 => get_basic(row, column, column_i, |a: i16| {
      Ok(JSONValue::Number(serde_json::Number::from(a)))
    })?,
    Type::INT4 => get_basic(row, column, column_i, |a: i32| {
      Ok(JSONValue::Number(serde_json::Number::from(a)))
    })?,
    Type::INT8 => get_basic(row, column, column_i, |a: i64| {
      Ok(JSONValue::Number(serde_json::Number::from(a)))
    })?,
    Type::TEXT | Type::VARCHAR => {
      get_basic(row, column, column_i, |a: String| Ok(JSONValue::String(a)))?
    }
    Type::JSON | Type::JSONB => get_basic(row, column, column_i, |a: JSONValue| Ok(a))?,
    Type::FLOAT4 => get_basic(row, column, column_i, |a: f32| f64_to_json_number(a.into()))?,
    Type::FLOAT8 => get_basic(row, column, column_i, |a: f64| f64_to_json_number(a))?,
    Type::NUMERIC => {
      let v: Decimal = row.get(column_i);
      JSONValue::String(v.to_string())
    }
    // these types require a custom StringCollector struct as an intermediary (see struct at bottom)
    Type::TS_VECTOR => get_basic(row, column, column_i, |a: StringCollector| {
      Ok(JSONValue::String(a.0))
    })?,
    Type::DATE => {
      let date: chrono::NaiveDate = row.get(column_i);
      JSONValue::String(date.to_string())
    }
    Type::TIME => get_basic(row, column, column_i, |a: StringCollector| {
      Ok(JSONValue::String(a.0))
    })?,
    Type::BYTEA => {
      let mut arr = vec![];
      let v: &[u8] = row.get(column_i);
      if v.is_empty() {
        JSONValue::Null
      } else {
        for u in v {
          arr.push(JSONValue::Number(serde_json::Number::from(*u)));
        }
        JSONValue::Array(arr)
      }
    }
    Type::TIMESTAMP => {
      let t: chrono::NaiveDateTime = row.get(column_i);
      JSONValue::String(t.to_string())
    }
    // array types
    Type::BOOL_ARRAY => get_array(row, column, column_i, |a: bool| Ok(JSONValue::Bool(a)))?,
    Type::INT2_ARRAY => get_array(row, column, column_i, |a: i16| {
      Ok(JSONValue::Number(serde_json::Number::from(a)))
    })?,
    Type::INT4_ARRAY => get_array(row, column, column_i, |a: i32| {
      Ok(JSONValue::Number(serde_json::Number::from(a)))
    })?,
    Type::INT8_ARRAY => get_array(row, column, column_i, |a: i64| {
      Ok(JSONValue::Number(serde_json::Number::from(a)))
    })?,
    Type::TEXT_ARRAY | Type::VARCHAR_ARRAY => {
      get_array(row, column, column_i, |a: String| Ok(JSONValue::String(a)))?
    }
    Type::JSON_ARRAY | Type::JSONB_ARRAY => get_array(row, column, column_i, |a: JSONValue| Ok(a))?,
    Type::FLOAT4_ARRAY => get_array(row, column, column_i, |a: f32| f64_to_json_number(a.into()))?,
    Type::FLOAT8_ARRAY => get_array(row, column, column_i, |a: f64| f64_to_json_number(a))?,
    // these types require a custom StringCollector struct as an intermediary (see struct at bottom)
    Type::TS_VECTOR_ARRAY => get_array(row, column, column_i, |a: StringCollector| {
      Ok(JSONValue::String(a.0))
    })?,

    Type::ANYENUM => {
      let val: GenericEnum = row.get(column_i);
      JSONValue::String(val.0)
    }
    _ => {
      log::warn!(
        "Cannot convert pg-cell \"{}\" of type \"{}\" to a JSONValue.",
        column.name(),
        column.type_().name()
      );
      println!(
        "{}={}, {:?}",
        column.type_().name(),
        column.type_().oid(),
        column.type_().kind()
      );
      let val: GenericEnum = row.get(column_i);
      JSONValue::String(val.0)
    }
  })
}

pub fn col_to_arrow_type(column: &Column) -> DataType {
  match *column.type_() {
    // for rust-postgres <> postgres type-mappings: https://docs.rs/postgres/latest/postgres/types/trait.FromSql.html#types
    // for postgres types: https://www.postgresql.org/docs/7.4/datatype.html#DATATYPE-TABLE

    // single types
    Type::BOOL => DataType::Boolean,
    Type::INT2 => DataType::Int64,
    Type::INT4 => DataType::Int64,
    Type::INT8 => DataType::Int64,
    Type::TEXT | Type::VARCHAR => DataType::Utf8,
    Type::JSON | Type::JSONB => DataType::Utf8,
    Type::FLOAT4 => DataType::Float64,
    Type::FLOAT8 => DataType::Float64,
    Type::NUMERIC => DataType::Utf8,
    // these types require a custom StringCollector struct as an intermediary (see struct at bottom)
    Type::TS_VECTOR => DataType::Utf8,

    Type::DATE => DataType::Utf8,
    Type::TIMESTAMP => DataType::Utf8,

    // array types
    Type::BOOL_ARRAY => DataType::Utf8,
    Type::INT2_ARRAY => DataType::Utf8,
    Type::INT4_ARRAY => DataType::Utf8,
    Type::INT8_ARRAY => DataType::Utf8,
    Type::BYTEA => DataType::Binary,
    Type::TEXT_ARRAY | Type::VARCHAR_ARRAY => {
      DataType::List(Arc::new(Field::new("", DataType::Utf8, true)))
    }
    Type::JSON_ARRAY | Type::JSONB_ARRAY => DataType::Utf8,
    Type::FLOAT4_ARRAY => DataType::Utf8,
    Type::FLOAT8_ARRAY => DataType::Utf8,
    // these types require a custom StringCollector struct as an intermediary (see struct at bottom)
    Type::TS_VECTOR_ARRAY => DataType::Utf8,

    Type::ANYENUM => DataType::Utf8,
    _ => DataType::Utf8,
  }
}

fn get_basic<'a, T: FromSql<'a>>(
  row: &'a Row,
  column: &Column,
  column_i: usize,
  val_to_json_val: impl Fn(T) -> Result<JSONValue, Error>,
) -> Result<JSONValue, Error> {
  let raw_val = row
    .try_get::<_, Option<T>>(column_i)
    .with_context(|| format!("column_name:{}", column.name()))?;
  raw_val.map_or(Ok(JSONValue::Null), val_to_json_val)
}
fn get_array<'a, T: FromSql<'a>>(
  row: &'a Row,
  column: &Column,
  column_i: usize,
  val_to_json_val: impl Fn(T) -> Result<JSONValue, Error>,
) -> Result<JSONValue, Error> {
  let raw_val_array = row
    .try_get::<_, Option<Vec<T>>>(column_i)
    .with_context(|| format!("column_name:{}", column.name()))?;
  Ok(match raw_val_array {
    Some(val_array) => {
      let mut result = vec![];
      for val in val_array {
        result.push(val_to_json_val(val)?);
      }
      JSONValue::Array(result)
    }
    None => JSONValue::Null,
  })
}

// you can remove this section if not using TS_VECTOR (or other types requiring an intermediary `FromSQL` struct)
struct StringCollector(String);
impl FromSql<'_> for StringCollector {
  fn from_sql(
    _: &Type,
    raw: &[u8],
  ) -> Result<StringCollector, Box<dyn std::error::Error + Sync + Send>> {
    let result = std::str::from_utf8(raw)?;
    Ok(StringCollector(result.to_owned()))
  }
  fn accepts(_ty: &Type) -> bool {
    true
  }
}

#[derive(Debug)]
struct GenericEnum(String);

impl FromSql<'_> for GenericEnum {
  fn from_sql(
    _: &Type,
    raw: &[u8],
  ) -> Result<GenericEnum, Box<dyn std::error::Error + Sync + Send>> {
    let result = std::str::from_utf8(raw).unwrap();
    let val = GenericEnum(result.to_owned());
    Ok(val)
  }
  fn accepts(_ty: &Type) -> bool {
    true
  }
}

#[tokio::test]
async fn test_database() {}
