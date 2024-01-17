use std::path::{Path, PathBuf};

use duckdb::{params, Connection};
use nanoid::format;

use crate::dialect::sql;
use crate::dialect::{Dialect, TreeNode};
use clickhouse_rs::{Block, Pool};

#[derive(Debug, Default)]
pub struct ClickhouseDialect {
  pub host: String,
  pub port: String,
  pub username: String,
  pub password: String,
}

impl ClickhouseDialect {
  fn get_url(&self) -> String {
    format!(
      "tcp://{}:{}@{}:{}/clicks?compression=lz4&ping_timeout=42ms",
      self.username, self.password, self.host, self.port,
    )
  }
}

struct Table {
  table_name: String,
  table_type: String,
  table_schema: String,
}

impl Dialect for ClickhouseDialect {
  async fn get_db(&self) -> Option<TreeNode> {
    let url = self.get_url();
    query(url).await.ok()?;
    None
  }
}

impl ClickhouseDialect {
  fn get_schema(&self) -> Vec<Table> {
    vec![]
  }
}

async fn query(url: String)-> Result<(), Box<dyn std::error::Error>> {
  let pool = Pool::new(url);
  let mut client = pool.get_handle().await?;
  let block = client
    .query("select database, name from system.tables")
    .fetch_all()
    .await?;
  for row in block.rows() {
    let database: String = row.get("database")?;
    let name: String = row.get("name")?;
    println!("tables: {}.{}", database, name);
  }
  Ok(())
}



// async fn execute(database_url: String) -> Result<(), Box<dyn std::error::Error>> {

//   let ddl = r"
//       CREATE TABLE IF NOT EXISTS payment (
//           customer_id  UInt32,
//           amount       UInt32,
//           account_name Nullable(FixedString(3))
//       ) Engine=Memory";

//   let mut block = Block::with_capacity(5);
//   block.push(row! { customer_id: 1_u32, amount:  2_u32, account_name: Some("foo") })?;
//   block.push(row! { customer_id: 3_u32, amount:  4_u32, account_name: None::<&str> })?;
//   block.push(row! { customer_id: 5_u32, amount:  6_u32, account_name: None::<&str> })?;
//   block.push(row! { customer_id: 7_u32, amount:  8_u32, account_name: None::<&str> })?;
//   block.push(row! { customer_id: 9_u32, amount: 10_u32, account_name: Some("bar") })?;

//   let pool = Pool::new(database_url);

//   let mut client = pool.get_handle().await?;
//   client.execute(ddl).await?;
//   client.insert("payment", block).await?;
//   let mut stream = client.query("SELECT * FROM payment").stream();

//   while let Some(row) = stream.next().await {
//       let row = row?;
//       let id: u32 = row.get("customer_id")?;
//       let amount: u32 = row.get("amount")?;
//       let name: Option<&str> = row.get("account_name")?;
//       println!("Found payment {id}: {amount} {name:?}");
//   }

//   Ok(())
// }