mod type_arrow;
mod type_json;

use std::fmt::Debug;
use std::sync::Arc;

use arrow::datatypes::{ArrowNativeType, Field, Schema};

use crate::dialect::Connection;
use crate::utils::{RawArrowData, Table, build_tree, json_to_arrow};
use crate::utils::{Title, TreeNode};
use async_trait::async_trait;
use futures_util::FutureExt;
use tokio_postgres::{Client, NoTls, Row};
use type_json::RowData;

#[derive(Debug, Default)]
pub struct PostgresConnection {
  pub host: String,
  pub port: String,
  pub username: String,
  pub password: String,
  pub database: Option<String>,
}

#[async_trait]
impl Connection for PostgresConnection {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    let tables = self.get_all_tables().await?;
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
  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<RawArrowData> {
    self._query(sql, limit, offset).await
  }

  async fn query_count(&self, sql: &str) -> anyhow::Result<usize> {
    let conn = self.get_conn(&self.database()).await?;
    let row = conn.query_one(sql, &[]).await?;
    let total: u32 = row.get(0);
    Ok(total as usize)
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

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    self._table_row_count(table, r#where).await
  }

  fn start_quote(&self) -> &'static str {
    "\""
  }

  fn end_quote(&self) -> &'static str {
    "\""
  }
}

impl PostgresConnection {
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
    let mut titles = vec![];
    for col in stmt.columns() {
      titles.push(Title {
        name: col.name().to_string(),
        r#type: col.type_().name().to_string(),
      });
      let typ = type_arrow::col_to_arrow_type(col);
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
    let schema = Arc::new(Schema::new(fields));

    let mut rows: Vec<RowData> = vec![];
    for row in conn.query(&stmt, &[]).await? {
      let r = type_json::postgres_row_to_row_data(row)?;
      rows.push(r);
    }

    let batch = json_to_arrow(&rows, schema)?;

    Ok(RawArrowData {
      total: batch.num_rows(),
      batch,
      titles: Some(titles),
      sql: Some(sql.to_string()),
    })
  }

  async fn _query_json(&self, sql: &str) -> anyhow::Result<()> {
    let conn = self.get_conn(&self.database()).await?;
    Ok(()) // TODO
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

#[tokio::test]
async fn test_database() {}
