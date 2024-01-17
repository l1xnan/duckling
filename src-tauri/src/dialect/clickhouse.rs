use std::collections::HashMap;
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
      "tcp://{}:{}@{}:{}/temp_database_lxn?compression=lz4&ping_timeout=42ms",
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
    if let Ok(tables) = get_tables(url).await {
      Some(get_db(&self.host, tables))
    } else {
      None
    }
  }
}

impl ClickhouseDialect {
  fn get_schema(&self) -> Vec<Table> {
    vec![]
  }
}

async fn get_tables(url: String) -> anyhow::Result<Vec<Table>> {
  let pool = Pool::new(url);
  let mut client = pool.get_handle().await?;
  let sql = r#"
  select database as table_schema, name as table_name, engine as table_type
  from system.tables order by table_schema
  "#;
  let block = client.query(sql).fetch_all().await?;
  let mut tables = Vec::new();
  for row in block.rows() {
    let table_schema: String = row.get("table_schema")?;
    let table_name: String = row.get("table_name")?;
    let table_type: String = row.get("table_type")?;
    println!("tables: {}.{}", table_schema, table_name);

    tables.push(Table {
      table_schema,
      table_name,
      table_type,
    })
  }
  Ok(tables)
}

pub fn get_db(path: &str, tables: Vec<Table>) -> TreeNode {
  let mut views_children = vec![];
  let mut tables_children = vec![];

  // let databses = HashMap<String>
  let mut database = None;

  let mut tree: HashMap<&str, TreeNode> = HashMap::new();

  for t in tables {
    let db_map = tree.entry(&t.table_schema).or_insert_with(TreeNode {
      node_type: "database".to_string(),
      name: t.table_schema,
      path: t.table_schema,
      children: Some(vec![]),
    });

    let node = TreeNode {
      name: t.table_name.clone(),
      path: t.table_name.clone(),
      node_type: String::from(if t.table_type == "View" {
        "view"
      } else {
        "table"
      }),
      children: None,
    };
    if t.table_type == "VIEW" {
      views_children.push(node);
    } else {
      tables_children.push(node);
    }
  }

  if let Some(ref mut vector) = db_map.get(&t.table_schema) {
    vector.push(TreeNode {
      name: "tables".to_string(),
      path: "tables".to_string(),
      node_type: "path".to_string(),
      children: Some(tables_children),
    });

    vector.push(TreeNode {
      name: "views".to_string(),
      path: "views".to_string(),
      node_type: "path".to_string(),
      children: Some(views_children),
    })
  }

  TreeNode {
    name: path.to_string(),
    path: path.to_string(),
    node_type: "database".to_string(),
    children: Some(vec![
      TreeNode {
        name: "tables".to_string(),
        path: "tables".to_string(),
        node_type: "path".to_string(),
        children: Some(tables_children),
      },
      TreeNode {
        name: "views".to_string(),
        path: "views".to_string(),
        node_type: "path".to_string(),
        children: Some(views_children),
      },
    ]),
  }
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
