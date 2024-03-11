use std::convert::From;
use std::sync::Arc;

use arrow::array::*;
use arrow::datatypes::*;
use arrow::datatypes::{DataType, Field, Schema};
use async_trait::async_trait;
use futures_util::StreamExt;
use rusqlite::types::Value;

use crate::api::RawArrowData;
use crate::api::{serialize_preview, ArrowData};
use crate::dialect::{Connection, Title, TreeNode};
use crate::utils::{build_tree, get_file_name, Table};

#[derive(Debug, Default)]
pub struct SqliteDialect {
  pub path: String,
}

#[async_trait]
impl Connection for SqliteDialect {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let url = self.get_url();
    let tables = self.get_tables().await?;
    let tree = build_tree(tables);
    let children = if tree.len() > 0 {
      &tree[0].children
    } else {
      &None
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

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    self._table_row_count(table, r#where).await
  }

  async fn show_schema(&self, schema: &str) -> anyhow::Result<RawArrowData> {
    let sql = format!(
      "
      SELECT * FROM sqlite_master
      WHERE type IN ('table', 'view') and name NOT IN ('sqlite_sequence', 'sqlite_stat1')
      ",
      schema
    );
    self.query(&sql, 0, 0).await
  }
}

impl SqliteDialect {
  fn get_url(&self) -> String {
    format!("{}", self.path)
  }

  async fn get_schema(&self) -> Vec<Table> {
    unimplemented!()
  }

  fn connect(&self) -> anyhow::Result<rusqlite::Connection> {
    Ok(rusqlite::Connection::open(&self.path)?)
  }

  async fn _query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    let conn = self.connect()?;
    let mut stmt = conn.prepare(sql)?;

    let mut fields = vec![];
    let k = stmt.column_count();
    let mut titles = vec![];
    for col in stmt.columns() {
      titles.push(Title {
        name: col.name().to_string(),
        r#type: col.decl_type().unwrap_or_default().to_string(),
      });
      let typ = if let Some(decl_type) = col.decl_type() {
        match decl_type {
          "INTEGER" => DataType::Int64,
          "REAL" => DataType::Float64,
          "BOOLEAN" => DataType::Boolean,
          "DATE" => DataType::Utf8,
          "DATETIME" => DataType::Utf8,
          "TIME" => DataType::Utf8,
          decl_type if decl_type.starts_with("NUMERIC") => DataType::Utf8,
          decl_type if decl_type.starts_with("NVARCHAR") => DataType::Utf8,
          "BLOB" => DataType::Binary,
          "NULL" => DataType::Null,
          _ => DataType::Utf8,
        }
      } else {
        DataType::Null
      };
      let field = Field::new(col.name(), typ, true);
      fields.push(field);
      println!("{:?} {:?}", col.name(), col.decl_type())
    }

    let schema = Schema::new(fields);
    let mut batchs = vec![];

    let mut rows = stmt.query([])?;
    println!("title={:?}", titles);

    while let Some(row) = rows.next()? {
      let mut arrs = vec![];

      for i in 0..k {
        let val = row.get::<_, Value>(i).unwrap();
        let r = convert_arrow(&val, &titles.get(i).unwrap().r#type);
        arrs.push(r);
      }
      let batch = RecordBatch::try_new(Arc::new(schema.clone()), arrs)?;
      batchs.push(batch);
    }

    let batch = arrow::compute::concat_batches(&Arc::new(schema), &batchs)?;

    Ok(RawArrowData {
      total_count: batch.num_rows(),
      batch,
      titles: Some(titles),
    })
  }
  pub(crate) async fn _table_row_count(&self, table: &str, cond: &str) -> anyhow::Result<usize> {
    let conn = self.connect()?;
    let sql = self._table_count_sql(table, cond);
    let total = conn.query_row(&sql, [], |row| row.get::<_, usize>(0))?;
    Ok(total)
  }
  fn fetch_all(&self, sql: &str) -> anyhow::Result<ArrowData> {
    let conn = self.connect()?;
    let mut stmt = conn.prepare(sql)?;

    let mut fields = vec![];
    let k = stmt.column_count();
    let mut titles = vec![];
    for col in stmt.columns() {
      titles.push(Title {
        name: col.name().to_string(),
        r#type: col.decl_type().unwrap_or_default().to_string(),
      });
      let typ = if let Some(decl_type) = col.decl_type() {
        match decl_type {
          "INTEGER" => DataType::Int64,
          "REAL" => DataType::Float64,
          "NUMERIC" => DataType::Utf8,
          "BOOLEAN" => DataType::Boolean,
          "DATE" => DataType::Utf8,
          "DATETIME" => DataType::Utf8,
          "TIME" => DataType::Utf8,
          "BLOB" => DataType::Binary,
          "NULL" => DataType::Null,
          _ => DataType::Utf8,
        }
      } else {
        DataType::Null
      };
      let field = Field::new(col.name(), typ, true);
      fields.push(field);
    }
    let schema = Schema::new(fields);

    let mut rows = stmt.query([])?;
    let mut tables: Vec<Vec<Value>> = (0..k).map(|_| vec![]).collect();
    while let Some(row) = rows.next()? {
      for i in 0..k {
        let val = row.get::<_, Value>(i).unwrap();
        tables[i].push(val);
      }
    }

    let mut arrs = vec![];
    for (col, title) in tables.iter().zip(titles) {
      let arr: ArrayRef = match title.r#type.as_str() {
        "INTEGER" => Arc::new(Int64Array::from(convert_to_i64s(col))),
        "REAL" => Arc::new(Float64Array::from(convert_to_f64s(col))),
        "NUMERIC" => Arc::new(StringArray::from(convert_to_strings(col))),
        "DATE" | "DATETIME" => Arc::new(StringArray::from(convert_to_strings(col))),
        "TIME" => Arc::new(StringArray::from(convert_to_strings(col))),
        "BOOLEAN" => Arc::new(StringArray::from(convert_to_strings(col))),
        _ => Arc::new(StringArray::from(convert_to_strings(col))),
      };
      arrs.push(arr);
    }
    let batch = RecordBatch::try_new(Arc::new(schema), arrs)?;

    Ok(ArrowData {
      total_count: batch.num_rows(),
      preview: serialize_preview(&batch)?,
      titles: None,
    })
  }
  async fn get_tables(&self) -> anyhow::Result<Vec<Table>> {
    let conn = self.connect()?;
    let sql = r#"
    SELECT tbl_name, name, type
    FROM sqlite_master
    WHERE type IN ('table', 'view') and name NOT IN ('sqlite_sequence', 'sqlite_stat1')
    "#;
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
  match value {
    Value::Integer(i) => {
      if typ.starts_with("NUMERIC") {
        Arc::new(StringArray::from(vec![i.to_string()])) as ArrayRef
      } else {
        Arc::new(Int64Array::from(vec![(*i)])) as ArrayRef
      }
    }
    Value::Real(f) => {
      if typ.starts_with("NUMERIC") {
        Arc::new(StringArray::from(vec![f.to_string()])) as ArrayRef
      } else {
        Arc::new(Float64Array::from(vec![(*f)])) as ArrayRef
      }
    }
    Value::Text(s) => Arc::new(StringArray::from(vec![s.clone()])) as ArrayRef,
    Value::Blob(b) => Arc::new(BinaryArray::from_vec(vec![b])) as ArrayRef,
    Value::Null => match typ {
      "TEXT" | "NUMERIC" => Arc::new(StringArray::from(vec![None::<String>])) as ArrayRef,
      "INTEGER" => Arc::new(Int64Array::from(vec![None::<i64>])) as ArrayRef,
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
  values.iter().map(|v| convert_to_string(v)).collect()
}

#[allow(dead_code)]
pub fn convert_to_i64s(values: &[Value]) -> Vec<Option<i64>> {
  values.iter().map(|v| convert_to_i64(v)).collect()
}

#[allow(dead_code)]
pub fn convert_to_f64s(values: &[Value]) -> Vec<Option<f64>> {
  values.iter().map(|v| convert_to_f64(v)).collect()
}

#[tokio::test]
async fn test_tables() {
  let _ = SqliteDialect {
    path: String::from(r""),
  };
}
