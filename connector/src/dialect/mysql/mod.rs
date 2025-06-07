mod type_arrow;
mod type_json;

use crate::dialect::Connection;
use crate::types::JSONValue;
use crate::utils::{build_tree, Metadata, RawArrowData, Table};
use crate::utils::{Title, TreeNode};
use anyhow::anyhow;
use arrow::array::*;
use arrow::datatypes::Schema;
use async_trait::async_trait;
use mysql::prelude::*;
use mysql::*;
use serde_json::json;
use std::collections::HashMap;
use std::fmt::Debug;
use std::sync::Arc;
use type_arrow::*;

#[derive(Debug, Default)]
pub struct MySqlConnection {
  pub host: String,
  pub port: String,
  pub username: String,
  pub password: String,
  pub database: Option<String>,
}

#[async_trait]
impl Connection for MySqlConnection {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let tables = self.get_tables()?;
    Ok(TreeNode {
      name: self.host.clone(),
      path: self.host.clone(),
      node_type: "root".to_string(),
      schema: None,
      children: Some(build_tree(tables)),
      size: None,
      comment: None,
    })
  }

  async fn query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    self._query(sql)
  }

  #[allow(clippy::unused_async)]
  async fn query_count(&self, sql: &str) -> anyhow::Result<usize> {
    let mut conn = self.get_conn()?;
    if let Some(total) = conn.query_first::<usize, _>(sql)? {
      Ok(total)
    } else {
      Err(anyhow::anyhow!("null"))
    }
  }

  async fn query_all(&self, sql: &str) -> anyhow::Result<RawArrowData> {
    self._query(sql)
  }

  async fn show_schema(&self, schema: &str) -> anyhow::Result<RawArrowData> {
    let sql = format!(
      "select * from information_schema.tables where TABLE_SCHEMA='{schema}' order by TABLE_TYPE, TABLE_NAME"
    );
    self.query(&sql, 0, 0).await
  }

  async fn show_column(&self, schema: Option<&str>, table: &str) -> anyhow::Result<RawArrowData> {
    let (db, tbl) = if schema.is_none() && table.contains('.') {
      let parts: Vec<&str> = table.splitn(2, '.').collect();
      (parts[0], parts[1])
    } else {
      ("", table)
    };
    let sql = format!(
      "select * from information_schema.columns where table_schema='{db}' and table_name='{tbl}'"
    );
    log::info!("show columns: {}", &sql);
    self.query(&sql, 0, 0).await
  }

  async fn all_columns(&self) -> anyhow::Result<Vec<Metadata>> {
    Ok(self._all_columns()?)
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    self._table_row_count(table, r#where)
  }
  fn validator(&self, id: &str) -> bool {
    // MySQL 规则: 字母, 数字, _, $; 不以数字开头
    if id.is_empty() {
      return false;
    }
    let mut chars = id.chars();
    let first = chars.next().unwrap(); // is_empty check ensures this is safe
    if first.is_ascii_digit() {
      return false;
    }
    if !(first.is_ascii_alphabetic() || first == '_' || first == '$') {
      return false;
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$')
  }
}

impl MySqlConnection {
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

  fn get_schema(&self) -> Vec<Table> {
    vec![]
  }
  pub fn get_tables(&self) -> anyhow::Result<Vec<Table>> {
    let mut conn = self.get_conn()?;

    let sql = r"
    select
      TABLE_SCHEMA as table_schema,
      TABLE_NAME as table_name,
      TABLE_TYPE as table_type,
      if(TABLE_TYPE='BASE TABLE', 'table', 'view') as type,
      CAST(round(((data_length + IFNULL(index_length, 0)) / 1024 / 1024)) AS UNSIGNED)  AS size
    from information_schema.tables
    ";
    let tables = conn.query_map(
      sql,
      |(table_schema, table_name, table_type, r#type, size)| Table {
        db_name: table_schema,
        table_name,
        table_type,
        r#type,
        size: Some(size),
        schema: None,
      },
    )?;
    Ok(tables)
  }

  fn _all_columns(&self) -> anyhow::Result<Vec<Metadata>> {
    let mut conn = self.get_conn()?;
    let sql = "
    SELECT
        table_schema,
        table_name,
        column_name,
        column_type
    FROM information_schema.columns
    -- WHERE table_schema NOT IN ('mysql', 'performance_schema', 'information_schema', 'sys') -- 排除系统库
    ORDER BY table_schema, table_name, ordinal_position;
    ";

    let rows: Vec<(String, String, String, String)> = conn.query(sql)?;

    // 使用 HashMap 按数据库和表名分组列信息
    let mut groups: HashMap<(String, String), Vec<(String, String)>> = HashMap::new();
    for (db, table, col, dtype) in rows {
      groups
        .entry((db, table))
        .or_insert_with(Vec::new)
        .push((col, dtype));
    }
    // 转换为最终结构
    let metadata_list: Vec<Metadata> = groups
      .into_iter()
      .map(|((database, table), columns)| Metadata {
        database,
        table,
        columns,
      })
      .collect();

    Ok(metadata_list)
  }

  fn _query(&self, sql: &str) -> anyhow::Result<RawArrowData> {
    let mut conn = self.get_conn()?;

    let mut result = conn.query_iter(sql)?;
    let columns = result.columns();
    let columns = columns.as_ref();
    let k = columns.len();

    let (fields, types) = get_fields(columns);
    let titles = self.get_titles(columns);
    let mut tables: Vec<Vec<Value>> = (0..k).map(|_| vec![]).collect();
    while let Some(result_set) = result.iter() {
      for row in result_set.flatten() {
        for (i, _col) in row.columns_ref().iter().enumerate() {
          let val = row.get::<Value, _>(i).unwrap();
          tables[i].push(val);
        }
      }
    }

    let arrs = convert_arrow(types, tables);

    let schema = Schema::new(fields);
    let batch = RecordBatch::try_new(Arc::new(schema), arrs)?;
    Ok(RawArrowData {
      total: batch.num_rows(),
      batch,
      titles: Some(titles.clone()),
      sql: Some(sql.to_string()),
    })
  }

  fn get_titles(&self, columns: &[Column]) -> Vec<Title> {
    let mut titles = vec![];
    for (i, col) in columns.iter().enumerate() {
      let type_ = format!("{:?}", col.column_type());
      let type_ = type_.strip_suffix("MYSQL_TYPE_").unwrap_or(type_.as_str());
      println!("{i}: {:?}, {:?}", col.name_str(), type_);
      titles.push(Title {
        name: col.name_str().to_string(),
        r#type: type_.to_string(),
      });
    }

    columns
      .iter()
      .enumerate()
      .map(|(i, col)| {
        let type_ = format!("{:?}", col.column_type());
        let type_ = type_.strip_suffix("MYSQL_TYPE_").unwrap_or(type_.as_str());
        println!("{i}: {:?}, {:?}", col.name_str(), type_);
        Title {
          name: col.name_str().to_string(),
          r#type: type_.to_string(),
        }
      })
      .collect()
  }

  fn _query_json(&self, sql: &str) -> anyhow::Result<JSONValue> {
    let mut conn = self.get_conn()?;
    let mut result = conn.query_iter(sql)?;
    let columns = result.columns();
    let columns = columns.as_ref();
    let titles = self.get_titles(columns);
    let data = type_json::fetch_dynamic_query_to_json(&mut result)?;
    let result = json! ({
      "titles": titles,
      "data": data
    });
    Ok(result)
  }
  fn _table_row_count(&self, table: &str, cond: &str) -> anyhow::Result<usize> {
    let mut conn = self.get_conn()?;
    let mut sql = format!("select count(*) from {table}");
    if !cond.is_empty() {
      sql = format!("{sql} where {cond}");
    }
    conn
      .query_first::<usize, _>(&sql)?
      .ok_or_else(|| anyhow!("No value found"))
  }
  fn _sql_row_count(&self, sql: &str) -> anyhow::Result<usize> {
    let mut conn = self.get_conn()?;
    conn
      .query_first::<usize, _>(&sql)?
      .ok_or_else(|| anyhow!("No value found"))
  }
}

#[tokio::test]
async fn test_query() {}
