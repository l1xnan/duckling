use calamine::{Reader, Xlsx, open_workbook};
use std::fs;
use std::path::Path;
use walkdir::{DirEntry, WalkDir};

use arrow::array::{Array, StringArray};
use async_trait::async_trait;
use glob::glob;

use crate::dialect::Connection;
use crate::dialect::duckdb::duckdb_sync;
use crate::utils::{Metadata, RawArrowData, TreeNode};

#[derive(Debug, Default)]
pub struct FolderConnection {
  pub path: String,
  pub cwd: Option<String>,
}

#[async_trait]
impl Connection for FolderConnection {
  async fn get_db(&self) -> anyhow::Result<TreeNode> {
    directory_tree(&self.path).ok_or_else(|| anyhow::anyhow!("null"))
  }

  async fn query(&self, sql: &str, limit: usize, offset: usize) -> anyhow::Result<RawArrowData> {
    let conn = self.connect()?;
    duckdb_sync::query(&conn, sql)
  }

  #[allow(clippy::unused_async)]
  async fn query_count(&self, sql: &str) -> anyhow::Result<usize> {
    let conn = self.connect()?;
    let total = conn.query_row(sql, [], |row| row.get::<_, usize>(0))?;
    Ok(total)
  }

  async fn all_columns(&self) -> anyhow::Result<Vec<Metadata>> {
    self._all_columns()
  }

  async fn show_column(&self, _schema: Option<&str>, table: &str) -> anyhow::Result<RawArrowData> {
    let path = Path::new(table);

    let ext = path.extension().unwrap_or_default();
    let sql = if path.is_dir() {
      let mut tmp = vec![];
      let pattern = format!("{table}/**/*.parquet");
      if exist_glob(&pattern) {
        tmp.push(format!("SELECT '*.parquet' as file_type, * FROM (DESCRIBE select * FROM read_parquet('{pattern}', union_by_name = true))"));
      }

      let pattern = format!("{table}/**/*.csv");
      if exist_glob(&pattern) {
        tmp.push(format!("SELECT '*.csv' as file_type, * FROM (DESCRIBE select * FROM read_csv('{pattern}', union_by_name = true))"));
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
  async fn table_row_count(&self, table: &str, r#where: &str) -> anyhow::Result<usize> {
    let conn = self.connect()?;
    let sql = self._table_count_sql(table, r#where);
    let total = conn.query_row(&sql, [], |row| row.get::<_, u32>(0))?;
    let total = total.to_string().parse()?;
    Ok(total)
  }

  fn normalize(&self, name: &str) -> String {
    name.to_string()
  }

  async fn export(&self, sql: &str, file: &str, format: &str) -> anyhow::Result<()> {
    let conn = self.connect()?;

    let _ = duckdb_sync::export(&conn, sql, file, format)?;

    Ok(())
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
    } else if ext == "xlsx" {
      format!("select * from read_xlsx('{table}', ignore_errors=true)")
    } else {
      String::new()
    };

    if sql.is_empty() {
      return Err(anyhow::anyhow!("file does not exist"));
    }
    log::info!("show columns: {}", &sql);

    let describe = format!("SELECT * FROM (DESCRIBE {sql})");
    let res = self.query(&describe, 0, 0).await;

    let mut likes = vec![];
    if let Ok(r) = res
      && let Some(col) = r.batch.column_by_name("column_name")
      && let Some(arr) = col.as_any().downcast_ref::<StringArray>()
    {
      for c in arr.into_iter().flatten() {
        let like = format!(
          "select filename, '{c}' as col from ({sql}) where CAST(\"{c}\" AS VARCHAR) like '%{value}%'"
        );
        likes.push(like);
      }
    }
    let detail = likes.join("\n union all \n");
    let sql = format!("select filename, col, count(*) as count from ({detail}) group by all");
    log::info!("{}", sql);
    self.query(&sql, 0, 0).await
  }
}

static EXTENSIONS: &[&'static str] = &["csv", "parquet", "xlsx", "json", "jsonl"];

impl FolderConnection {
  fn new(path: &str) -> Self {
    Self {
      path: String::from(path),
      cwd: None,
    }
  }

  fn connect(&self) -> anyhow::Result<duckdb::Connection> {
    let conn = duckdb::Connection::open_in_memory()?;
    conn.execute(&format!("SET file_search_path='{}'", self.path.clone()), [])?;
    Ok(conn)
  }

  fn _all_columns(&self) -> anyhow::Result<Vec<Metadata>> {
    // 遍历目录并过滤文件
    let files: Vec<_> = WalkDir::new(self.path.clone())
      .into_iter()
      .filter_map(|e| e.ok()) // 过滤无效路径[7](@ref)
      .filter(|entry| {
        let path = entry.path();
        // 排除目录，仅保留文件
        path.is_file()
          && path // 提取扩展名并匹配目标类型
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| EXTENSIONS.contains(&ext.to_lowercase().as_str()))
            .unwrap_or(false)
      })
      .collect();

    let mut data = vec![];
    for file in files {
      let path = file
        .path()
        .strip_prefix(&self.path)?
        .display()
        .to_string()
        .replace('\\', "/");
      data.push(Metadata {
        database: String::new(),
        table: format!("./{}", path),
        columns: vec![],
      });
    }
    Ok(data)
  }
}

pub fn directory_tree<P: AsRef<Path>>(path: P) -> Option<TreeNode> {
  let path = path.as_ref();
  let is_dir = path.is_dir();
  let name = path
    .file_name()
    .unwrap_or_default()
    .to_string_lossy()
    .to_string();

  let mut node_type = String::from("path");
  let mut size = None;

  if !is_dir {
    size = path.metadata().ok().map(|m| m.len());

    if let Some(file_ext) = path.extension() {
      let file_ext = file_ext.to_string_lossy().to_string();
      if !EXTENSIONS.contains(&file_ext.as_str()) {
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
      for entry in entries.flatten() {
        let child_path = entry.path();
        if let Some(child_node) = directory_tree(&child_path) {
          child_nodes.push(child_node);
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
    schema: None,
    children,
    node_type,
    size,
    comment: None,
  })
}

fn exist_glob(pattern: &str) -> bool {
  if let Ok(ref mut items) = glob(pattern)
    && let Some(Ok(_)) = items.next()
  {
    return true;
  }
  false
}

fn sheet_names<P: AsRef<Path>>(path: P) -> Result<Vec<String>, calamine::Error> {
  let mut workbook: Xlsx<_> = open_workbook(path)?; // 只读元数据，不解析数据
  Ok(workbook.sheet_names())
}

#[tokio::test]
async fn test_table() {
  use arrow::util::pretty::print_batches;
  let _d = FolderConnection::new(r"D:\Code\duckdb\data\parquet-testing");
  let res = _d
    .find("123", r"D:/Code/duckdb/data/parquet-testing/decimal")
    .await
    .unwrap();
  let _ = print_batches(&[res.batch]);
}
