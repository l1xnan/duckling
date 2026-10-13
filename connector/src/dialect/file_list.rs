use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::time::SystemTime;

use arrow::array::{ArrayRef, Int64Array, RecordBatch, StringArray};
use arrow::datatypes::{DataType, Field, Schema};
use chrono::{DateTime, Local};
use walkdir::WalkDir;

use crate::utils::{RawArrowData, Title};

/// Extensions Duckling reads as tables — the folder tree shows the same set.
pub const READABLE_EXTENSIONS: &[&str] = &["csv", "tsv", "parquet", "xlsx", "json", "jsonl"];

/// Counting rows means reading the file, so huge files are left uncounted.
const MAX_SCAN_BYTES: u64 = 128 * 1024 * 1024;

/// One readable file below the listed folder.
#[derive(Debug, Clone, PartialEq)]
pub struct FileEntry {
  pub filename: String,
  pub size: u64,
  pub last_modified: Option<String>,
  pub rows: Option<i64>,
}

fn is_readable(path: &Path) -> bool {
  path
    .extension()
    .and_then(|ext| ext.to_str())
    .map(|ext| READABLE_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
    .unwrap_or(false)
}

fn normalize(path: &Path) -> String {
  path.display().to_string().replace('\\', "/")
}

fn format_modified(time: SystemTime) -> Option<String> {
  let modified: DateTime<Local> = time.into();
  Some(modified.format("%Y-%m-%d %H:%M:%S").to_string())
}

fn file_entry(path: &Path) -> Option<FileEntry> {
  if !path.is_file() || !is_readable(path) {
    return None;
  }
  let metadata = fs::metadata(path).ok()?;
  Some(FileEntry {
    filename: normalize(path),
    size: metadata.len(),
    last_modified: metadata.modified().ok().and_then(format_modified),
    rows: None,
  })
}

/// Readable files below `dir`, recursively, sorted by path.
pub fn collect_files(dir: &Path) -> Vec<FileEntry> {
  let mut entries: Vec<FileEntry> = WalkDir::new(dir)
    .into_iter()
    .filter_map(|entry| entry.ok())
    .filter_map(|entry| file_entry(entry.path()))
    .collect();
  entries.sort_by(|a, b| a.filename.cmp(&b.filename));
  entries
}

/// Row-count query for a file, plus whether running it reads the whole file.
fn count_sql(filename: &str) -> Option<(String, bool)> {
  let ext = Path::new(filename)
    .extension()?
    .to_str()?
    .to_lowercase();
  let literal = filename.replace('\'', "''");
  let (sql, scans) = match ext.as_str() {
    // Footer only — no data is read, whatever the file size.
    "parquet" => (
      format!("select num_rows from parquet_file_metadata('{literal}')"),
      false,
    ),
    "csv" => (
      format!("select count(*) from read_csv_auto('{literal}')"),
      true,
    ),
    "tsv" => (
      format!("select count(*) from read_csv_auto('{literal}', delim='\t')"),
      true,
    ),
    "json" | "jsonl" => (
      format!("select count(*) from read_json_auto('{literal}')"),
      true,
    ),
    _ => return None,
  };
  Some((sql, scans))
}

/// Rows in `entry`, or `None` when unsupported, too large, or unreadable.
///
/// `wrap` lets remote dialects route the statement through their own transport
/// (quack sends every query to the server as a string).
pub fn count_rows(
  conn: &duckdb::Connection,
  entry: &FileEntry,
  wrap: &dyn Fn(&str) -> String,
) -> Option<i64> {
  let (sql, scans) = count_sql(&entry.filename)?;
  if scans && entry.size > MAX_SCAN_BYTES {
    return None;
  }
  conn.query_row(&wrap(&sql), [], |row| row.get::<_, i64>(0)).ok()
}

/// Fill in `rows` for every entry, leaving it `None` where counting fails.
pub fn fill_row_counts(
  entries: &mut [FileEntry],
  conn: &duckdb::Connection,
  wrap: &dyn Fn(&str) -> String,
) {
  for entry in entries.iter_mut() {
    entry.rows = count_rows(conn, entry, wrap);
  }
}

/// Files reachable from a DuckDB engine, via `read_blob` on the directory:
/// the server reports path, byte size and last write time without reading the
/// file contents.
pub fn remote_files(
  conn: &duckdb::Connection,
  dir: &str,
  wrap: &dyn Fn(&str) -> String,
) -> anyhow::Result<Vec<FileEntry>> {
  let base = dir.trim_end_matches('/');
  let literal = format!("{base}/**/*").replace('\'', "''");
  let sql = format!(
    "select filename, size, \
     strftime(last_modified, '%Y-%m-%d %H:%M:%S') as last_modified \
     from read_blob('{literal}') order by filename"
  );

  let mut stmt = conn.prepare(&wrap(&sql))?;
  let entries = stmt
    .query_map([], |row| {
      Ok(FileEntry {
        // Keep separators consistent with the tree built from `glob`.
        filename: row.get::<_, String>(0)?.replace('\\', "/"),
        size: row.get::<_, Option<i64>>(1)?.unwrap_or_default().max(0) as u64,
        last_modified: row.get::<_, Option<String>>(2)?,
        rows: None,
      })
    })?
    .collect::<Result<Vec<_>, _>>()?;
  Ok(entries)
}

pub fn file_list_batch(entries: &[FileEntry]) -> anyhow::Result<RecordBatch> {
  let schema = Arc::new(Schema::new(vec![
    Field::new("filename", DataType::Utf8, false),
    Field::new("size", DataType::Int64, false),
    Field::new("rows", DataType::Int64, true),
    Field::new("last_modified", DataType::Utf8, true),
  ]));

  let columns: Vec<ArrayRef> = vec![
    Arc::new(
      entries
        .iter()
        .map(|entry| Some(entry.filename.as_str()))
        .collect::<StringArray>(),
    ),
    Arc::new(
      entries
        .iter()
        .map(|entry| Some(entry.size as i64))
        .collect::<Int64Array>(),
    ),
    Arc::new(
      entries
        .iter()
        .map(|entry| entry.rows)
        .collect::<Int64Array>(),
    ),
    Arc::new(
      entries
        .iter()
        .map(|entry| entry.last_modified.as_deref())
        .collect::<StringArray>(),
    ),
  ];

  Ok(RecordBatch::try_new(schema, columns)?)
}

fn file_list_titles() -> Vec<Title> {
  vec![
    Title {
      name: "filename".to_string(),
      r#type: "VARCHAR".to_string(),
    },
    Title {
      name: "size".to_string(),
      r#type: "BIGINT".to_string(),
    },
    Title {
      name: "rows".to_string(),
      r#type: "BIGINT".to_string(),
    },
    Title {
      name: "last_modified".to_string(),
      r#type: "TIMESTAMP".to_string(),
    },
  ]
}

/// Wrap entries as the table list shown by the explorer.
pub fn entries_to_raw_data(entries: &[FileEntry]) -> anyhow::Result<RawArrowData> {
  let batch = file_list_batch(entries)?;
  Ok(RawArrowData {
    total: batch.num_rows(),
    batch,
    titles: Some(file_list_titles()),
    sql: None,
  })
}

/// A local folder as a table list: path, size, row count and last write time.
pub fn file_list(dir: &str) -> anyhow::Result<RawArrowData> {
  let mut entries = collect_files(Path::new(dir));
  let conn = duckdb::Connection::open_in_memory()?;
  let local = |sql: &str| sql.to_string();
  fill_row_counts(&mut entries, &conn, &local);
  entries_to_raw_data(&entries)
}

#[cfg(test)]
mod tests {
  use super::*;
  use arrow::array::Array;
  use std::io::Write;

  fn temp_dir() -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("duckling_file_list_{}", nanoid::nanoid!(8)));
    fs::create_dir_all(&dir).unwrap();
    dir
  }

  fn write(path: &Path, content: &str) {
    let mut file = fs::File::create(path).unwrap();
    file.write_all(content.as_bytes()).unwrap();
  }

  /// Statements run verbatim: only quack needs to route them elsewhere.
  fn local(sql: &str) -> String {
    sql.to_string()
  }

  #[test]
  fn collects_readable_files_recursively_with_sizes() {
    let dir = temp_dir();
    write(&dir.join("b.csv"), "id\n1\n2\n");
    write(&dir.join("skip.md"), "not a table");
    fs::create_dir_all(dir.join("nested")).unwrap();
    write(&dir.join("nested").join("a.parquet"), "not really a parquet");

    let entries = collect_files(&dir);

    let names: Vec<&str> = entries.iter().map(|e| e.filename.as_str()).collect();
    assert_eq!(names.len(), 2);
    assert!(names[0].ends_with("/b.csv"));
    assert!(names[1].ends_with("/nested/a.parquet"));
    assert_eq!(entries[0].size, "id\n1\n2\n".len() as u64);
    assert!(entries[0].last_modified.is_some());
    assert!(entries.iter().all(|entry| entry.rows.is_none()));

    fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn counts_rows_for_csv_tsv_and_parquet_only() {
    let dir = temp_dir();
    write(&dir.join("rows.csv"), "id,name\n1,a\n2,b\n3,c\n");
    write(&dir.join("rows.tsv"), "id\tname\n1\ta\n2\tb\n");
    write(&dir.join("notes.xlsx"), "binary");

    let mut entries = collect_files(&dir);
    let conn = duckdb::Connection::open_in_memory().unwrap();
    fill_row_counts(&mut entries, &conn, &local);

    let rows: Vec<(&str, Option<i64>)> = entries
      .iter()
      .map(|entry| (entry.filename.as_str(), entry.rows))
      .collect();
    let by_suffix = |suffix: &str| {
      rows.iter()
        .find(|(filename, _)| filename.ends_with(suffix))
        .and_then(|(_, rows)| *rows)
    };
    assert_eq!(rows.len(), 3);
    assert_eq!(by_suffix("rows.csv"), Some(3));
    assert_eq!(by_suffix("rows.tsv"), Some(2));
    assert_eq!(by_suffix("notes.xlsx"), None);

    fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn parquet_row_count_comes_from_the_footer() {
    let dir = temp_dir();
    let file = dir.join("data.parquet");
    let literal = normalize(&file);
    let conn = duckdb::Connection::open_in_memory().unwrap();
    conn.execute_batch(&format!(
      "copy (select range as id from range(7)) to '{literal}' (format parquet)"
    ))
    .unwrap();

    let entries = collect_files(&dir);
    assert_eq!(entries.len(), 1);
    assert_eq!(count_rows(&conn, &entries[0], &local), Some(7));

    fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn oversized_files_skip_the_row_count_unless_the_footer_has_it() {
    let conn = duckdb::Connection::open_in_memory().unwrap();
    let csv = FileEntry {
      filename: "/data/huge.csv".to_string(),
      size: MAX_SCAN_BYTES + 1,
      last_modified: None,
      rows: None,
    };
    assert_eq!(count_rows(&conn, &csv, &local), None);

    // A parquet footer is O(1), so the size cap must not apply to it.
    let (sql, scans) = count_sql("/data/huge.parquet").unwrap();
    assert!(!scans);
    assert!(sql.contains("parquet_file_metadata"));
  }

  #[test]
  fn remote_files_read_size_and_mtime_from_read_blob() {
    let dir = temp_dir();
    write(&dir.join("rows.csv"), "id,name\n1,a\n2,b\n");
    fs::create_dir_all(dir.join("nested")).unwrap();
    write(&dir.join("nested").join("more.csv"), "id\n1\n");

    let conn = duckdb::Connection::open_in_memory().unwrap();
    let mut entries = remote_files(&conn, &normalize(&dir), &local).unwrap();
    assert_eq!(entries.len(), 2);
    assert!(entries[0].filename.ends_with("nested/more.csv"));
    assert_eq!(entries[0].size, "id\n1\n".len() as u64);
    assert!(entries[0].last_modified.is_some());
    assert!(entries[1].filename.ends_with("rows.csv"));

    fill_row_counts(&mut entries, &conn, &local);
    assert_eq!(entries[0].rows, Some(1));
    assert_eq!(entries[1].rows, Some(2));

    fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn remote_files_tolerate_an_empty_folder() {
    let dir = temp_dir();
    let conn = duckdb::Connection::open_in_memory().unwrap();

    let entries = remote_files(&conn, &normalize(&dir), &local).unwrap();
    assert!(entries.is_empty());

    fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn batch_exposes_the_four_columns_and_nulls() {
    let entries = vec![
      FileEntry {
        filename: "/data/a.csv".to_string(),
        size: 1536,
        last_modified: Some("2024-01-01 00:00:00".to_string()),
        rows: Some(12),
      },
      FileEntry {
        filename: "/data/b.xlsx".to_string(),
        size: 2048,
        last_modified: None,
        rows: None,
      },
    ];

    let batch = file_list_batch(&entries).unwrap();

    let schema = batch.schema();
    let names: Vec<&str> = schema
      .fields()
      .iter()
      .map(|field| field.name().as_str())
      .collect();
    assert_eq!(names, ["filename", "size", "rows", "last_modified"]);
    assert_eq!(batch.num_rows(), 2);
    assert_eq!(batch.column(2).null_count(), 1);
    assert_eq!(batch.column(3).null_count(), 1);
  }
}
