use std::fmt::Debug;
use std::sync::Arc;

use arrow::array::*;
use arrow::datatypes::{DataType, Field, Schema};
use async_trait::async_trait;
use mysql::consts::ColumnType::*;
use mysql::prelude::*;
use mysql::*;

use crate::api::{serialize_preview, ArrowData, RawArrowData};
use crate::dialect::Title;
use crate::dialect::{Dialect, TreeNode};
use crate::utils::{build_tree, Table};

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
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let tables = self.get_tables()?;
    Ok(TreeNode {
      name: self.host.clone(),
      path: self.host.clone(),
      node_type: "root".to_string(),
      children: Some(build_tree(tables)),
    })
  }

  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<ArrowData> {
    let data = self._query(sql, limit, offset).await?;
    Ok(ArrowData {
      total_count: data.total_count,
      preview: serialize_preview(&data.batch)?,
      titles: data.titles,
    })
  }
}

impl MySqlDialect {
  fn new(host: &str, port: &str, username: &str, password: &str) -> Self {
    Self {
      host: host.to_string(),
      port: port.to_string(),
      username: username.to_string(),
      password: password.to_string(),
      database: None,
    }
  }

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

  fn get_conn(&self) -> anyhow::Result<PooledConn> {
    let binding = self.get_url();
    let url = binding.as_str();
    let pool = Pool::new(url)?;
    Ok(pool.get_conn()?)
  }

  async fn get_schema(&self) -> Vec<Table> {
    vec![]
  }
  pub fn get_tables(&self) -> anyhow::Result<Vec<Table>> {
    let mut conn = self.get_conn()?;

    let sql = r#"
    select
      TABLE_SCHEMA as table_schema,
      TABLE_NAME as table_name,
      TABLE_TYPE as table_type,
      if(TABLE_TYPE='BASE TABLE', 'table', 'view') as type
    from information_schema.tables
    "#;
    let tables = conn.query_map(sql, |(table_schema, table_name, table_type, r#type)| {
      Table {
        db_name: table_schema,
        table_name,
        table_type,
        r#type,
        schema: None,
      }
    })?;
    Ok(tables)
  }

  async fn _query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    let mut conn = self.get_conn()?;

    let mut result = conn.query_iter(sql)?;
    let columns = result.columns();
    let columns = columns.as_ref();
    let k = columns.len();

    // let stmt = conn.prep(sql)?;
    // let k = stmt.num_columns();
    // let columns = stmt.columns();

    let mut fields = vec![];
    let mut titles = vec![];
    let mut types = vec![];
    for (i, col) in columns.iter().enumerate() {
      println!("{i}: {:?}, {:?}", col.name_str(), col.column_type());
      titles.push(Title {
        name: col.name_str().to_string(),
        r#type: format!("{:?}", col.column_type()),
      });
      types.push(col.column_type());
      let typ = match col.column_type() {
        MYSQL_TYPE_TINY | MYSQL_TYPE_INT24 | MYSQL_TYPE_SHORT | MYSQL_TYPE_LONG
        | MYSQL_TYPE_LONGLONG => DataType::Int64,
        MYSQL_TYPE_DECIMAL
        | MYSQL_TYPE_NEWDECIMAL
        | MYSQL_TYPE_FLOAT
        | MYSQL_TYPE_YEAR
        | MYSQL_TYPE_DOUBLE => DataType::Float64,
        MYSQL_TYPE_DATETIME => DataType::Utf8,
        MYSQL_TYPE_DATE => DataType::Utf8,
        MYSQL_TYPE_BLOB => DataType::Utf8,
        MYSQL_TYPE_STRING | MYSQL_TYPE_VAR_STRING | MYSQL_TYPE_VARCHAR => DataType::Utf8,
        _ => DataType::Binary,
      };
      let field = Field::new(col.name_str(), typ, true);
      fields.push(field);
    }
    let mut tables: Vec<Vec<Value>> = (0..k).map(|_| vec![]).collect();
    while let Some(result_set) = result.iter() {
      for row in result_set {
        if let Ok(r) = row {
          for (i, _col) in r.columns_ref().iter().enumerate() {
            let val = r.get::<Value, _>(i).unwrap();
            tables[i].push(val);
          }
        }
      }
    }

    let mut arrs = vec![];
    for (type_, col) in types.iter().zip(tables) {
      println!("{:?}", col);
      let arr: ArrayRef = match type_ {
        MYSQL_TYPE_TINY | MYSQL_TYPE_INT24 | MYSQL_TYPE_SHORT | MYSQL_TYPE_LONG
        | MYSQL_TYPE_LONGLONG => Arc::new(Int64Array::from(convert_to_i64_arr(&col))),
        MYSQL_TYPE_DECIMAL
        | MYSQL_TYPE_NEWDECIMAL
        | MYSQL_TYPE_FLOAT
        | MYSQL_TYPE_YEAR
        | MYSQL_TYPE_DOUBLE => Arc::new(Float64Array::from(convert_to_f64_arr(&col))),
        MYSQL_TYPE_STRING | MYSQL_TYPE_VAR_STRING | MYSQL_TYPE_VARCHAR => {
          Arc::new(StringArray::from(convert_to_str_arr(&col)))
        }
        MYSQL_TYPE_DATETIME => Arc::new(StringArray::from(convert_to_str_arr(&col))),
        MYSQL_TYPE_DATE => Arc::new(StringArray::from(convert_to_str_arr(&col))),
        MYSQL_TYPE_BLOB => Arc::new(StringArray::from(convert_to_str_arr(&col))),
        _ => Arc::new(StringArray::from(convert_to_str_arr(&col))),
      };

      arrs.push(arr);
    }

    let schema = Schema::new(fields);
    let batch = RecordBatch::try_new(Arc::new(schema), arrs)?;
    Ok(RawArrowData {
      total_count: batch.num_rows(),
      batch,
      titles: Some(titles.clone()),
    })
  }
}

fn convert_val(unknown_val: Value) {
  match unknown_val {
    val @ Value::NULL => {
      println!("An empty value: {:?}", from_value::<Option<u8>>(val))
    }
    val @ Value::Bytes(..) => {
      // It's non-utf8 bytes, since we already tried to convert it to String
      println!("Bytes: {:?}", from_value::<Vec<u8>>(val))
    }
    val @ Value::Int(..) => {
      println!("A signed integer: {}", from_value::<i64>(val))
    }
    val @ Value::UInt(..) => {
      println!("An unsigned integer: {}", from_value::<u64>(val))
    }
    Value::Float(..) => unreachable!("already tried"),
    val @ Value::Double(..) => {
      println!("A double precision float value: {}", from_value::<f64>(val))
    }
    val @ Value::Date(..) => {
      use time::PrimitiveDateTime;
      println!("A date value: {}", from_value::<PrimitiveDateTime>(val))
    }
    val @ Value::Time(..) => {
      use std::time::Duration;
      println!("A time value: {:?}", from_value::<Duration>(val))
    }
  };
}

fn convert_to_str(unknown_val: &Value) -> Option<String> {
  match unknown_val {
    val @ Value::Bytes(..) => {
      let val = from_value::<Vec<u8>>(val.clone());
      String::from_utf8(val).ok()
    }
    _ => None,
  }
}

fn convert_to_str_arr(values: &[Value]) -> Vec<Option<String>> {
  values.iter().map(|v| convert_to_str(v)).collect()
}

fn convert_to_i64(unknown_val: &Value) -> Option<i64> {
  match unknown_val {
    val @ Value::Int(..) => {
      let val = from_value::<i64>(val.clone());
      Some(val)
    }
    val @ Value::UInt(..) => {
      let val = from_value::<i64>(val.clone());
      Some(val)
    }
    val @ Value::Bytes(..) => {
      let val = from_value::<i64>(val.clone());
      Some(val)
    }
    _ => None,
  }
}

fn convert_to_i64_arr(values: &[Value]) -> Vec<Option<i64>> {
  values.iter().map(|v| convert_to_i64(v)).collect()
}

fn convert_to_i32(unknown_val: &Value) -> Option<i32> {
  match unknown_val {
    val @ Value::Int(..) => {
      let val = from_value::<i32>(val.clone());
      Some(val)
    }
    _ => None,
  }
}

fn convert_to_i32_arr(values: &[Value]) -> Vec<Option<i32>> {
  values.iter().map(|v| convert_to_i32(v)).collect()
}

fn convert_to_u64(unknown_val: &Value) -> Option<u64> {
  match unknown_val {
    val @ Value::UInt(..) => {
      let val = from_value::<u64>(val.clone());
      Some(val)
    }
    val @ Value::Int(..) => {
      let val = from_value::<u64>(val.clone());
      Some(val)
    }
    val @ Value::Bytes(..) => {
      let val = from_value::<u64>(val.clone());
      Some(val)
    }
    _ => None,
  }
}

fn convert_to_u64_arr(values: &[Value]) -> Vec<Option<u64>> {
  values.iter().map(|v| convert_to_u64(v)).collect()
}

fn convert_to_f64(unknown_val: &Value) -> Option<f64> {
  match unknown_val {
    val @ Value::Float(..) => {
      let val = from_value::<f64>(val.clone());
      Some(val)
    }
    val @ Value::Double(..) => {
      let val = from_value::<f64>(val.clone());
      Some(val)
    }
    val @ Value::Bytes(..) => {
      let val = from_value::<f64>(val.clone());
      Some(val)
    }
    _ => None,
  }
}

fn convert_to_f64_arr(values: &[Value]) -> Vec<Option<f64>> {
  values.iter().map(|v| convert_to_f64(v)).collect()
}

#[tokio::test]
async fn test_query() {}
