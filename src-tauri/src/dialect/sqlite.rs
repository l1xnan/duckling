use std::sync::Arc;

use arrow::array::*;
use arrow::datatypes::*;
use arrow::datatypes::{DataType, Field, Schema};
use async_trait::async_trait;
use rusqlite::types::Value;
use rusqlite::Connection;

use crate::api::{serialize_preview, ArrowData};
use crate::dialect::{Dialect, TreeNode};
use crate::utils::{build_tree, get_file_name, Table};

#[derive(Debug, Default)]
pub struct SqliteDialect {
  pub path: String,
}

pub struct Title {
  pub name: String,
  pub r#type: String,
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
    let conn = Connection::open(&self.path)?;
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
      println!("{:?} {:?}", col.name(), col.decl_type())
    }

    let schema = Schema::new(fields);
    let mut batchs = vec![];

    let mut rows = stmt.query([])?;

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
  let conn = Connection::open(path)?;
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
      table_schema: String::new(),
      r#type: row.get(2)?,
    });
  }
  Ok(tables)
}

pub fn convert_arrow(value: &Value, typ: &str) -> ArrayRef {
  // println!("{:?}", value);
  match value {
    Value::Integer(i) => {
      if typ == "NUMERIC" {
        Arc::new(StringArray::from(vec![i.to_string()])) as ArrayRef
      } else {
        Arc::new(Int64Array::from(vec![(*i)])) as ArrayRef
      }
    }
    Value::Real(f) => {
      if typ == "NUMERIC" {
        Arc::new(StringArray::from(vec![f.to_string()])) as ArrayRef
      } else {
        Arc::new(Float64Array::from(vec![(*f)])) as ArrayRef
      }
    }
    Value::Text(s) => Arc::new(StringArray::from(vec![s.clone()])) as ArrayRef,
    Value::Blob(b) => Arc::new(BinaryArray::from_vec(vec![b])) as ArrayRef,
    Value::Null => match typ {
      "TEXT" | "NUMERIC" => Arc::new(StringArray::from(vec![Option::<String>::None])) as ArrayRef,
      "INTEGER" => Arc::new(Int64Array::from(vec![Option::<i64>::None])) as ArrayRef,
      _ => Arc::new(StringArray::from(vec![Option::<String>::None])) as ArrayRef,
    },
  }
}
