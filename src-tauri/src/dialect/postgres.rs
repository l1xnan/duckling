use std::fmt::Debug;
use std::sync::Arc;

use crate::api::{serialize_preview, ArrowData};
use crate::dialect::Title;
use crate::dialect::{Dialect, TreeNode};
use crate::utils::{build_tree, Table};
use arrow::array::*;
use arrow::datatypes::{DataType, Field, Schema};
use async_trait::async_trait;
use futures_util::{join, FutureExt};
use std::time::Duration;
use tokio::time;
use tokio_postgres::error::SqlState;
use tokio_postgres::{Client, NoTls};

#[derive(Debug, Default)]
pub struct PostgresDialect {
  pub host: String,
  pub port: String,
  pub username: String,
  pub password: String,
  pub database: Option<String>,
}

#[async_trait]
impl Dialect for PostgresDialect {
  async fn get_db(&self) -> Option<TreeNode> {
    if let Ok(tables) = self.get_all_tables().await {
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
    let mut conn = self.get_conn("").await?;

    let mut stmt = conn.prepare(sql).await?;
    let mut fields = vec![];
    let k = stmt.columns().len();
    let mut titles = vec![];
    for col in stmt.columns() {
      titles.push(Title {
        name: col.name().to_string(),
        r#type: col.type_().name().to_string(),
      });
      let typ = match col.type_().name() {
        "bool" => DataType::Boolean,

        _ => DataType::Binary,
      };
      let field = Field::new(col.name(), typ, true);
      fields.push(field);
    }
    println!("titles: {:?}", titles);
    let mut result = conn.query(&stmt, &[]).await?;

    let mut arrs: Vec<ArrayRef> = vec![];

    let schema = Schema::new(fields);
    let batch = RecordBatch::try_new(Arc::new(schema), arrs)?;
    Ok(ArrowData {
      total_count: batch.num_rows(),
      preview: serialize_preview(&batch)?,
    })
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
      "".to_string()
    } else {
      format!(" dbname={}", db)
    };
    let config = self.get_url() + &db;
    Ok(connect(&config).await)
  }

  async fn get_schema(&self) -> Vec<Table> {
    vec![]
  }
  pub async fn databases(&self) -> anyhow::Result<Vec<String>> {
    let mut client = self.get_conn("postgres").await?;
    let sql = "SELECT datname FROM pg_database WHERE datistemplate = false";

    let mut names = vec![];
    for row in client.query(sql, &[]).await? {
      let name: String = row.get(0);
      println!("{}", name);
      names.push(row.get(0));
    }
    Ok(names)
  }
  pub async fn get_tables(&self, db: &str) -> anyhow::Result<Vec<Table>> {
    let mut client = self.get_conn(db).await?;

    let sql = r#"
    select
      table_catalog as db_name,
      table_name as table_name,
      table_type as table_type,
      CASE WHEN table_type='BASE TABLE' THEN 'table' ELSE 'view' END as type
    from information_schema.tables WHERE table_schema='public'
    "#;
    let mut tables = vec![];
    for row in client.query(sql, &[]).await? {
      tables.push(Table {
        table_schema: row.get::<_, String>(0),
        table_name: row.get::<_, String>(1),
        table_type: row.get::<_, String>(2),
        r#type: row.get::<_, String>(3),
      });
    }
    println!("{}: {:?}", db, tables);
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
}

async fn connect(s: &str) -> Client {
  let (client, connection) = tokio_postgres::connect(s, NoTls).await.unwrap();
  let connection = connection.map(|e| e.unwrap());
  tokio::spawn(connection);

  client
}

#[tokio::test]
async fn test_database() {}
