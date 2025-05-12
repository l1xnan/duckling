use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::str;
use std::sync::Arc;

use crate::api::RawArrowData;
use crate::dialect::Connection;
use crate::utils::{Table, TreeNode, build_tree};
use arrow::array::*;
use arrow::datatypes::*;
use arrow::json::ReaderBuilder;
use async_trait::async_trait;
use clickhouse::{Client, Row};
use serde::{Deserialize, Serialize};

use crate::utils::Title;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ClickhouseConnection {
  pub host: String,
  pub port: String,
  pub username: String,
  pub password: String,
  pub database: Option<String>,
}

#[async_trait]
impl Connection for ClickhouseConnection {
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

  async fn query(&self, sql: &str, _limit: usize, _offset: usize) -> anyhow::Result<RawArrowData> {
    self.fetch_all(sql).await
  }
  #[allow(clippy::unused_async)]
  async fn query_count(&self, _sql: &str) -> anyhow::Result<usize> {
    Ok(0)
  }

  async fn show_schema(&self, schema: &str) -> anyhow::Result<RawArrowData> {
    let sql = format!(
      "select * except(uuid) from system.tables where database='{schema}' order by engine, name"
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
    let sql = format!("select * from system.columns where database='{db}' and table='{tbl}'");
    log::info!("show columns: {}", &sql);
    self.query(&sql, 0, 0).await
  }

  async fn all_columns(&self) -> anyhow::Result<HashMap<String, Vec<String>>> {
    Ok(self._all_columns().await?)
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    self._table_row_count(table, r#where).await
  }
}

#[derive(Row, Serialize, Deserialize)]
struct TableRow {
  db_name: String,
  table_name: String,
  table_type: String,
  r#type: String,
  total_bytes: Option<u64>,
}

#[derive(Row, Serialize, Deserialize)]
struct ColumnRow {
  database: String,
  table: String,
  name: String,
}

#[derive(Debug, Deserialize)]
struct Statistics {
  bytes_read: u64,
  elapsed: f64,
}
#[derive(Debug, Clone, Deserialize)]
struct MetaItem {
  name: String,
  r#type: String, // 注意: "type" 是 Rust 关键字，可使用 #[serde(rename = "type")]
}
#[derive(Debug, Deserialize)]
struct JSONColumnsWithMetadataResponse {
  meta: Vec<MetaItem>,
  rows: u32,
  statistics: Statistics,
  data: serde_json::Value,
  // 其他字段可以选择性定义
}

impl ClickhouseConnection {
  pub fn new(host: &str, port: &str, username: &str, password: &str) -> Self {
    Self {
      host: host.to_string(),
      port: port.to_string(),
      username: username.to_string(),
      password: password.to_string(),
      database: None,
    }
  }

  async fn client(&self) -> anyhow::Result<Client> {
    let url = if self.host.starts_with("http://") || self.host.starts_with("https://") {
      self.host.clone()
    } else {
      format!("http://{}:{}", self.host, self.port)
    };
    let client = Client::default()
      .with_url(url)
      .with_user(&self.username)
      .with_password(&self.password)
      .with_database(self.database.clone().unwrap_or_default());
    Ok(client)
  }

  fn get_schema(&self) -> Vec<Table> {
    vec![]
  }
  async fn get_tables(&self) -> anyhow::Result<Vec<Table>> {
    // TODO: comment field
    let sql = "
      select database as db_name, name as table_name, engine as table_type,
        if(engine='View', 'view', 'table') as type, total_bytes
      from system.tables order by database, table_type
      ";
    let client = self.client().await?;
    let rows = client.query(sql).fetch_all::<TableRow>().await?;
    let mut tables = Vec::new();
    for row in rows {
      tables.push(Table {
        db_name: row.db_name,
        table_name: row.table_name,
        table_type: row.table_type,
        r#type: row.r#type,
        schema: None,
        size: row.total_bytes,
      });
    }
    Ok(tables)
  }

  async fn _all_columns(&self) -> anyhow::Result<HashMap<String, Vec<String>>> {
    let sql = "select database, table, name from system.columns";
    let client = self.client().await?;
    let rows = client.query(sql).fetch_all::<ColumnRow>().await?;
    let mut table_columns: HashMap<String, Vec<String>> = HashMap::new();
    for row in rows {
      table_columns
        .entry(format!("{}.{}", row.database, row.table))
        .or_default()
        .push(row.name);
    }
    Ok(table_columns)
  }
  async fn _table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let conn = self.client().await?;
    let sql = self._table_count_sql(table, r#where);
    let total = conn.query(&sql).fetch_one::<usize>().await?;
    Ok(total)
  }

  async fn export(&self, sql: &str, file: &str) -> anyhow::Result<()> {
    let client = self.client().await?;
    let mut cursor = client.query(sql).fetch_bytes("CSV")?;
    let mut file = File::create(file)?;
    while let Some(bytes) = cursor.next().await? {
      file.write_all(&bytes)?;
    }
    Ok(())
  }

  async fn _fetch_all(&self, sql: &str) -> anyhow::Result<JSONColumnsWithMetadataResponse> {
    let client = self.client().await?;
    // https://clickhouse.com/docs/interfaces/formats/JSONStrings
    let mut cursor = client.query(sql).fetch_bytes("JSONStrings")?;
    let bytes = cursor.collect().await?;
    let res: JSONColumnsWithMetadataResponse = serde_json::from_slice(&bytes)?;
    Ok(res)
  }
  async fn fetch_all(&self, sql: &str) -> anyhow::Result<RawArrowData> {
    let res = self._fetch_all(sql).await?;
    let titles = res
      .meta
      .clone()
      .into_iter()
      .map(|m| Title {
        name: m.name,
        r#type: m.r#type,
      })
      .collect::<Vec<_>>();

    let default: Vec<serde_json::Value> = Vec::default();
    let data = res.data.as_array().unwrap_or(&default);
    let fields = res
      .meta
      .into_iter()
      .map(|m| Field::new(m.name, DataType::LargeUtf8, true))
      .collect::<Vec<Field>>();
    let schema = Arc::new(Schema::new(fields));
    let batch = json_to_arrow(data, schema)?;
    Ok(RawArrowData {
      total: batch.num_rows(),
      batch,
      titles: Some(titles),
      sql: Some(sql.to_string()),
    })
  }
}

pub fn json_to_arrow<S: Serialize>(rows: &[S], schema: SchemaRef) -> anyhow::Result<RecordBatch> {
  let mut decoder = ReaderBuilder::new(schema).build_decoder()?;
  decoder.serialize(rows)?;
  let batch = decoder.flush()?.unwrap();
  Ok(batch)
}

#[tokio::test]
async fn test_clickhouse() {
  use arrow::util::pretty::print_batches;
  let conn = ClickhouseConnection::new("https://play.clickhouse.com", "", "play", "");
  let res = conn
    .fetch_all("SELECT * FROM system.tables limit 10")
    .await
    .unwrap();
  let batch = res.batch;
  let _ = print_batches(&[batch]);
}

#[tokio::test]
async fn test_tables() {
  let conn = ClickhouseConnection::new("https://play.clickhouse.com", "", "play", "");
  let res = conn.get_tables().await;
  println!("{:?}", res);
}
