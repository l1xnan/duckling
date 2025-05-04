mod arrow_type;
mod json_type;

use std::collections::HashMap;
use std::convert::From;
use std::sync::Arc;

use arrow::array::*;
use arrow::datatypes::{Field, Schema};
use async_trait::async_trait;
use rusqlite::types::Value;
use rusqlite::Statement;

use crate::api::RawArrowData;
use crate::dialect::sqlite::arrow_type::{db_result_to_arrow, db_to_arrow_type};
use crate::dialect::sqlite::json_type::db_result_to_json;
use crate::dialect::Connection;
use crate::utils::{build_tree, get_file_name, json_to_arrow, Table, Title, TreeNode};

#[derive(Debug, Default)]
pub struct SqliteConnection {
  pub path: String,
}

pub struct SQLiteStatement<'conn> {
  pub stmt: rusqlite::Statement<'conn>,
}

#[async_trait]
impl Connection for SqliteConnection {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let tables = self.get_tables().await?;
    let tree = build_tree(tables);
    let children = if tree.is_empty() {
      &None
    } else {
      &tree[0].children
    };
    Ok(TreeNode {
      name: get_file_name(&self.path),
      path: self.path.clone(),
      node_type: "root".to_string(),
      children: children.clone(),
      size: None,
      comment: None,
    })
  }

  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<RawArrowData> {
    self._query(sql, limit, offset).await
  }

  async fn show_schema(&self, _schema: &str) -> anyhow::Result<RawArrowData> {
    let sql = "
      SELECT * FROM sqlite_master
      WHERE type IN ('table', 'view') and name NOT IN ('sqlite_sequence', 'sqlite_stat1')
      ";
    self.query(sql, 0, 0).await
  }

  async fn show_column(&self, _schema: Option<&str>, table: &str) -> anyhow::Result<RawArrowData> {
    let sql = format!("select * from pragma_table_info('{table}')");
    self.query(&sql, 0, 0).await
  }

  async fn all_columns(&self) -> anyhow::Result<HashMap<String, Vec<String>>> {
    let columns = self._all_columns().await?;
    Ok(columns)
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    self._table_row_count(table, r#where).await
  }

  #[allow(clippy::unused_async)]
  async fn query_count(&self, sql: &str) -> anyhow::Result<usize> {
    let conn = self.connect()?;
    let total = conn.query_row(sql, [], |row| row.get::<_, usize>(0))?;
    Ok(total)
  }
}

impl SqliteConnection {
  async fn get_schema(&self) -> Vec<Table> {
    unimplemented!()
  }

  fn connect(&self) -> anyhow::Result<rusqlite::Connection> {
    Ok(rusqlite::Connection::open(&self.path)?)
  }

  #[allow(clippy::unused_async)]
  async fn _query_arrow(
    &self,
    sql: &str,
    _limit: usize,
    _offset: usize,
  ) -> anyhow::Result<RawArrowData> {
    let conn = self.connect()?;
    let mut stmt = conn.prepare(sql)?;

    let (titles, schema) = Self::get_arrow_schema(&mut stmt);
    let k = stmt.column_count();
    let mut batchs = vec![];

    let mut rows_iter = stmt.query([])?;
    println!("title={titles:?}");

    while let Some(row) = rows_iter.next()? {
      let mut arrs = vec![];

      for i in 0..k {
        let val = row.get::<_, Value>(i).unwrap_or(Value::Null);
        let r = convert_arrow(&val, &titles.get(i).unwrap().r#type);
        arrs.push(r);
      }
      let batch = RecordBatch::try_new(schema.clone(), arrs)?;
      batchs.push(batch);
    }

    let mut rows: Vec<Vec<Value>> = vec![];
    while let Some(row_ref) = rows_iter.next()? {
      let mut row = Vec::with_capacity(k);
      for col_index in 0..k {
        let value = row_ref.get::<_, Value>(col_index).unwrap_or(Value::Null);
        row.push(value);
      }
      rows.push(row);
    }

    let batch = arrow::compute::concat_batches(&schema, &batchs)?;

    Ok(RawArrowData {
      total: batch.num_rows(),
      batch,
      titles: Some(titles),
      sql: Some(sql.to_string()),
    })
  }

  #[allow(clippy::unused_async)]
  async fn _query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    let conn = self.connect()?;
    let mut stmt = conn.prepare(sql)?;
    let batch = db_result_to_arrow(&mut stmt)?;
    let (titles, schema) = Self::get_arrow_schema(&mut stmt);

    Ok(RawArrowData {
      total: batch.num_rows(),
      batch,
      titles: Some(titles),
      sql: Some(sql.to_string()),
    })
  }
  #[allow(clippy::unused_async)]
  async fn _all_columns(&self) -> anyhow::Result<HashMap<String, Vec<String>>> {
    let table_names = self._all_table_names().await?;
    let conn = self.connect()?;

    let mut tables = HashMap::new();
    for table_name in table_names {
      let sql = format!("select name from pragma_table_info('{table_name}')");
      let mut stmt = conn.prepare(&sql)?;
      let rows = stmt.query_map([], |row| row.get(0))?;
      let mut columns: Vec<String> = Vec::new();
      for name_result in rows {
        columns.push(name_result?);
      }
      tables.insert(table_name, columns);
    }
    Ok(tables)
  }

  async fn _all_table_names(&self) -> anyhow::Result<Vec<String>> {
    let sql = "
      SELECT name FROM sqlite_master
      WHERE type IN ('table', 'view') and name NOT IN ('sqlite_sequence', 'sqlite_stat1')
      ";
    let conn = self.connect()?;
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    let mut table_names: Vec<String> = Vec::new();
    for name_result in rows {
      table_names.push(name_result?);
    }
    Ok(table_names)
  }
  #[allow(clippy::unused_async)]
  async fn _query_json(
    &self,
    sql: &str,
    _limit: usize,
    _offset: usize,
  ) -> anyhow::Result<RawArrowData> {
    let conn = self.connect()?;
    let mut stmt = conn.prepare(sql)?;
    let (titles, schema) = Self::get_arrow_schema(&mut stmt);
    let batch = db_result_to_json(&mut stmt)?;
    let batch = json_to_arrow(&batch, schema)?;
    Ok(RawArrowData {
      total: batch.num_rows(),
      batch,
      titles: Some(titles),
      sql: Some(sql.to_string()),
    })
  }

  fn get_arrow_schema(stmt: &mut Statement) -> (Vec<Title>, Arc<Schema>) {
    let mut fields = vec![];
    let mut titles = vec![];
    for col in stmt.columns() {
      titles.push(Title {
        name: col.name().to_string(),
        r#type: col.decl_type().unwrap_or_default().to_string(),
      });
      let typ = db_to_arrow_type(col.decl_type());
      let field = Field::new(col.name(), typ, true);
      fields.push(field);
      println!("{:?} {:?}", col.name(), col.decl_type());
    }

    let schema = Schema::new(fields);
    (titles, Arc::new(schema))
  }

  #[allow(clippy::unused_async)]
  pub(crate) async fn _table_row_count(&self, table: &str, cond: &str) -> anyhow::Result<usize> {
    let conn = self.connect()?;
    let sql = self._table_count_sql(table, cond);
    let total = conn.query_row(&sql, [], |row| row.get::<_, usize>(0))?;
    Ok(total)
  }

  #[allow(clippy::unused_async)]
  async fn get_tables(&self) -> anyhow::Result<Vec<Table>> {
    let conn = self.connect()?;
    let sql = "
      SELECT tbl_name, name, type
      FROM sqlite_master
      WHERE type IN ('table', 'view') and name NOT IN ('sqlite_sequence', 'sqlite_stat1')";
    let mut stmt = conn.prepare(sql)?;
    let mut rows = stmt.query([])?;
    let mut tables: Vec<Table> = Vec::new();
    while let Some(row) = rows.next()? {
      tables.push(Table {
        table_name: row.get(1)?,
        table_type: row.get(2)?,
        db_name: String::new(),
        r#type: row.get(2)?,
        schema: None,
        size: None,
      });
    }
    Ok(tables)
  }
}

pub fn convert_arrow(value: &Value, typ: &str) -> ArrayRef {
  println!("{:?}", value);
  match value {
    Value::Integer(i) => {
      if typ.starts_with("NUMERIC") || typ.is_empty() {
        Arc::new(StringArray::from(vec![i.to_string()])) as ArrayRef
      } else {
        Arc::new(Int64Array::from(vec![(*i)])) as ArrayRef
      }
    }
    Value::Real(f) => {
      if typ.starts_with("NUMERIC") || typ.is_empty() {
        Arc::new(StringArray::from(vec![f.to_string()])) as ArrayRef
      } else {
        Arc::new(Float64Array::from(vec![(*f)])) as ArrayRef
      }
    }
    Value::Text(s) => Arc::new(StringArray::from(vec![s.clone()])) as ArrayRef,
    Value::Blob(b) => Arc::new(LargeBinaryArray::from_vec(vec![b])) as ArrayRef,
    Value::Null => match typ {
      "TEXT" | "NUMERIC" => Arc::new(StringArray::from(vec![None::<String>])) as ArrayRef,
      "INTEGER" => Arc::new(Int64Array::from(vec![None::<i64>])) as ArrayRef,
      "BLOB" => Arc::new(LargeBinaryArray::from_opt_vec(vec![None::<&[u8]>])) as ArrayRef,
      _ => Arc::new(StringArray::from(vec![None::<String>])) as ArrayRef,
    },
  }
}

#[allow(dead_code)]
pub fn convert_to_string(value: &Value) -> Option<String> {
  match value {
    Value::Integer(i) => Some(i.to_string()),
    Value::Real(f) => Some(f.to_string()),
    Value::Text(s) => Some(s.clone()),
    Value::Blob(b) => String::from_utf8(b.clone()).ok(),
    Value::Null => None::<String>,
  }
}

#[allow(dead_code)]
pub fn convert_to_i64(value: &Value) -> Option<i64> {
  match value {
    Value::Integer(i) => Some(*i),
    Value::Real(f) => Some(*f as i64),
    Value::Text(s) => s.parse::<i64>().ok(),
    _ => None::<i64>,
  }
}

pub fn convert_to_f64(value: &Value) -> Option<f64> {
  match value {
    Value::Integer(i) => i.to_string().parse::<f64>().ok(),
    Value::Real(f) => Some(*f),
    Value::Text(s) => s.parse::<f64>().ok(),
    _ => None::<f64>,
  }
}

#[allow(dead_code)]
pub fn convert_to_strings(values: &[Value]) -> Vec<Option<String>> {
  values.iter().map(convert_to_string).collect()
}

#[allow(dead_code)]
pub fn convert_to_i64s(values: &[Value]) -> Vec<Option<i64>> {
  values.iter().map(convert_to_i64).collect()
}

#[allow(dead_code)]
pub fn convert_to_f64s(values: &[Value]) -> Vec<Option<f64>> {
  values.iter().map(convert_to_f64).collect()
}

#[tokio::test]
async fn test_tables() {
  use arrow::util::pretty::print_batches;
  let d = SqliteConnection {
    path: String::from(r""),
  };
  let res = d.query("", 0, 0).await.unwrap();
  let _ = print_batches(&[res.batch]);
}
