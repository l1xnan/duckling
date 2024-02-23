use arrow::array::*;
use async_trait::async_trait;
use mysql::prelude::*;
use mysql::*;

use crate::api::ArrowData;
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
  async fn get_db(&self) -> Option<TreeNode> {
    let url = self.get_url();
    if let Ok(tables) = get_tables(&url).await {
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

  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<ArrowData> {
    unimplemented!()
  }
}

impl MySqlDialect {
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

  async fn get_schema(&self) -> Vec<Table> {
    vec![]
  }
}

pub async fn get_tables(url: &str) -> anyhow::Result<Vec<Table>> {
  let pool = Pool::new(url)?;

  let mut conn = pool.get_conn()?;

  let sql = r#"
  select 
    TABLE_SCHEMA as table_schema, 
    TABLE_NAME as table_name,
    TABLE_TYPE as table_type,
    if(TABLE_TYPE='BASE TABLE', 'table', 'view') as type
  from information_schema.tables
  "#;
  let mut tables = vec![];
  let mut result = conn.query_iter(sql)?;
  while let Some(result_set) = result.iter() {
    for row in result_set {
      if let Ok(r) = row {
        tables.push(Table {
          table_schema: r.get::<String, _>(0).unwrap(),
          table_name: r.get::<String, _>(1).unwrap(),
          table_type: r.get::<String, _>(2).unwrap(),
          r#type: r.get::<String, _>(2).unwrap(),
        });
      }
    }
  }

  Ok(tables)
}
