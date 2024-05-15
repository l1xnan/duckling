use std::fs;
use std::path::Path;

use arrow::array::{Array, AsArray, StringArray};
use async_trait::async_trait;
use glob::glob;

use crate::api;
use crate::dialect::Connection;
use crate::dialect::RawArrowData;
use crate::utils::{write_csv, TreeNode};

#[derive(Debug, Default)]
pub struct FolderDialect {
  pub path: String,
  pub cwd: Option<String>,
}

#[async_trait]
impl Connection for FolderDialect {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    directory_tree(self.path.as_str()).ok_or_else(|| anyhow::anyhow!("null"))
  }

  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<RawArrowData> {
    api::query(":memory:", sql, limit, offset, self.cwd.clone())
  }

  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let conn = self.connect()?;
    let sql = self._table_count_sql(table, r#where);
    let total = conn.query_row(&sql, [], |row| row.get::<_, u32>(0))?;
    let total = total.to_string().parse()?;
    Ok(total)
  }

  async fn export(&self, sql: &str, file: &str) {
    let data = api::fetch_all(":memory:", sql, self.cwd.clone());
    if let Ok(batch) = data {
      write_csv(file, &batch);
    }
  }

  async fn show_column(&self, _schema: Option<&str>, table: &str) -> anyhow::Result<RawArrowData> {
    let path = Path::new(table);

    let ext = path.extension().unwrap_or_default();
    let sql = if path.is_dir() {
      let mut tmp = vec![];
      let pattern = format!("{table}/**/*.parquet");
      if exist_glob(&pattern) {
        tmp.push(format!("SELECT '*.parquet' as file_type, * FROM (DESCRIBE select * FROM read_parquet('{pattern}', union_by_name = true))"))
      }

      let pattern = format!("{table}/**/*.csv");
      if exist_glob(&pattern) {
        tmp.push(format!("SELECT '*.csv' as file_type, * FROM (DESCRIBE select * FROM read_csv('{pattern}', union_by_name = true))"))
      }

      tmp.join("\n union all \n")
    } else if ext == "parquet" {
      format!("DESCRIBE select * from read_parquet('{table}')")
    } else if ext == "csv" {
      format!("DESCRIBE select * from read_csv('{table}', union_by_name=true)")
    } else {
      String::new()
    };
    log::info!("show columns: {}", &sql);
    self.query(&sql, 0, 0).await
  }
  async fn drop_table(&self, _schema: Option<&str>, table: &str) -> anyhow::Result<String> {
    let path = Path::new(table);
    if path.is_dir() {
      fs::remove_dir_all(path)?;
    } else {
      fs::remove_file(path)?;
    }
    Ok(String::new())
  }

  #[allow(clippy::unused_async)]
  async fn query_count(&self, sql: &str) -> anyhow::Result<usize> {
    let conn = self.connect()?;
    let total = conn.query_row(sql, [], |row| row.get::<_, usize>(0))?;
    Ok(total)
  }

  fn normalize(&self, name: &str) -> String {
    name.to_string()
  }
  #[allow(clippy::unused_async)]
  async fn find(&self, value: &str, table: &str) -> anyhow::Result<RawArrowData> {
    let path = Path::new(table);

    let ext = path.extension().unwrap_or_default();
    let sql = if path.is_dir() {
      let mut tmp = vec![];
      let pattern = format!("{table}/**/*.parquet");
      if exist_glob(&pattern) {
        tmp.push(format!(
          "select * FROM read_parquet('{pattern}', union_by_name=true, filename=true)"
        ));
      }

      let pattern = format!("{table}/**/*.csv");
      if exist_glob(&pattern) {
        tmp.push(format!(
          "select * FROM read_csv('{pattern}', union_by_name=true, filename=true)"
        ));
      }

      tmp.join("\n union all \n")
    } else if ext == "parquet" {
      format!("select * from read_parquet('{table}', union_by_name=true, filename=true)")
    } else if ext == "csv" {
      format!("select * from read_csv('{table}', union_by_name=true, filename=true)")
    } else {
      String::new()
    };
    log::info!("show columns: {}", &sql);

    let describe = format!("SELECT * FROM (DESCRIBE {sql})");
    let res = self.query(&describe, 0, 0).await;

    let mut likes = vec![];
    if let Ok(r) = res {
      if let Some(col) = r.batch.column_by_name("column_name") {
        if let Some(arr) = col.as_any().downcast_ref::<StringArray>() {
          for c in arr.into_iter().flatten() {
            let like = format!(
                "select filename, '{c}' as col from ({sql}) where CAST(\"{c}\" AS VARCHAR) like '%{value}%'"
              );
            likes.push(like);
          }
        }
      }
    }
    let detail = likes.join("\n union all \n");
    let sql = format!("select filename, col, count(*) as count from ({detail}) group by all");
    log::info!("{}", sql);
    self.query(&sql, 0, 0).await
  }
}

fn exist_glob(pattern: &str) -> bool {
  if let Ok(ref mut items) = glob(pattern) {
    if let Some(item) = items.next() {
      return match item {
        Ok(_path) => true,
        Err(_e) => false,
      };
    }
  }
  false
}

impl FolderDialect {
  fn new(path: &str) -> Self {
    Self {
      path: String::from(path),
      cwd: None,
    }
  }

  fn connect(&self) -> anyhow::Result<duckdb::Connection> {
    Ok(duckdb::Connection::open_in_memory()?)
  }
}

pub fn directory_tree<P: AsRef<Path>>(path: P) -> Option<TreeNode> {
  let path = path.as_ref();
  let is_dir = path.is_dir();
  let name = path.file_name().unwrap().to_string_lossy().to_string();

  // TODO: support xlsx
  let support_types = ["csv", "parquet"];

  let mut node_type = String::from("path");
  let mut size = None;

  if !is_dir {
    size = path.metadata().ok().map(|m| m.len());

    if let Some(file_ext) = path.extension() {
      let file_ext = file_ext.to_string_lossy().to_string();
      if !support_types.contains(&file_ext.as_str()) {
        return None;
      }

      if name.starts_with("~$") && name.ends_with(".xlsx") {
        return None;
      }

      if name.starts_with("~$") && file_ext == "xlsx" {
        return None;
      }

      node_type = file_ext;
    }
  };

  let mut children = None;

  if is_dir {
    if let Ok(entries) = fs::read_dir(path) {
      let mut child_nodes = Vec::new();
      for entry in entries {
        if let Ok(entry) = entry {
          let child_path = entry.path();
          if let Some(child_node) = directory_tree(&child_path) {
            child_nodes.push(child_node);
          }
        }
      }

      child_nodes.sort_by(|a, b| {
        (a.node_type == "path")
          .cmp(&(b.node_type == "path"))
          .reverse()
          .then(a.name.cmp(&b.name))
      });

      children = Some(child_nodes);
    }
  }

  Some(TreeNode {
    name,
    path: path.display().to_string().replace('\\', "/"),
    children,
    node_type,
    size,
    comment: None,
  })
}

#[tokio::test]
async fn test_table() {
  use arrow::util::pretty::print_batches;
  let _d = FolderDialect::new(r"D:\Code\duckdb\data\parquet-testing");
  let res = _d
    .find("123", r"D:/Code/duckdb/data/parquet-testing/decimal")
    .await
    .unwrap();
  print_batches(&[res.batch]);
}
