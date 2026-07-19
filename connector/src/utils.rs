use anyhow::{Result, anyhow};
use arrow::array::*;
use arrow::csv::WriterBuilder;
use arrow::datatypes::SchemaRef;
use arrow::datatypes::*;
use arrow::ipc::writer::StreamWriter;
use arrow::json::ReaderBuilder;
use arrow::record_batch::RecordBatch;
use arrow::util::display::FormatOptions;
use chrono::NaiveDate;
use chrono::{Datelike, NaiveDateTime, Timelike};
use parquet::basic::{BrotliLevel, Compression, GzipLevel, ZstdLevel};
use parquet::{arrow::ArrowWriter, file::properties::WriterProperties};
use rust_xlsxwriter::{Workbook, XlsxError};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs::File;
use std::io::Write;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeNode {
  pub name: String,
  pub path: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub children: Option<Vec<TreeNode>>,
  #[serde(rename(serialize = "type"))]
  pub node_type: String,
  pub schema: Option<String>,
  pub size: Option<u64>,
  pub comment: Option<String>,
}

impl TreeNode {
  pub fn new_views(key: &str, children: Option<Vec<TreeNode>>) -> Self {
    Self {
      name: "views".to_string(),
      path: format!("{key}-views"),
      node_type: "path".to_string(),
      children,
      size: None,
      schema: None,
      comment: None,
    }
  }
  pub fn new_tables(key: &str, children: Option<Vec<TreeNode>>) -> Self {
    Self {
      name: "tables".to_string(),
      path: format!("{key}-tables"),
      node_type: "path".to_string(),
      children,
      size: None,
      schema: None,
      comment: None,
    }
  }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Title {
  pub name: String,
  pub r#type: String,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Metadata {
  pub database: String,
  pub table: String,
  pub columns: Vec<(String, String)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Table {
  pub table_name: String,
  pub table_type: String,
  pub db_name: String,
  pub schema: Option<String>,
  pub r#type: String,
  pub size: Option<u64>,
}

pub struct RawArrowData {
  /// The total number of rows that were selected.
  pub total: usize,
  pub batch: RecordBatch,
  pub titles: Option<Vec<Title>>,
  pub sql: Option<String>,
}

impl RawArrowData {
  pub fn from_batch(batch: RecordBatch) -> Self {
    Self {
      total: batch.num_rows(),
      titles: None,
      sql: None,
      batch,
    }
  }
}

pub fn get_file_name<P: AsRef<Path>>(path: P) -> String {
  path
    .as_ref()
    .file_name()
    .unwrap()
    .to_string_lossy()
    .to_string()
}

pub fn build_tree(tables: Vec<Table>) -> Vec<TreeNode> {
  let mut databases = vec![];

  let mut tree: BTreeMap<String, Vec<TreeNode>> = BTreeMap::new();

  for t in tables {
    let db = tree.entry(t.db_name.clone()).or_default();
    let mut keys = vec![];
    if !t.db_name.is_empty() {
      keys.push(t.db_name.clone());
    }
    if let Some(schema) = t.schema.clone() {
      keys.push(schema);
    }
    keys.push(t.table_name.clone());
    let path = keys.join(".");
    db.push(TreeNode {
      name: t.table_name,
      path,
      node_type: t.r#type,
      schema: t.schema,
      children: None,
      size: t.size,
      comment: None,
    });
  }
  for (key, nodes) in &tree {
    let mut tables_children = vec![];
    let mut views_children = vec![];

    for node in nodes {
      if node.node_type == "view" {
        views_children.push(node.clone());
      } else {
        tables_children.push(node.clone());
      }
    }

    databases.push(TreeNode {
      name: key.to_string(),
      path: key.to_string(),
      node_type: "database".to_string(),
      schema: None,
      children: Some(vec![
        TreeNode::new_tables(key, Some(tables_children)),
        TreeNode::new_views(key, Some(views_children)),
      ]),
      size: None,
      comment: None,
    });
  }

  databases
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExportOptions {
  pub header: Option<bool>,
  pub delimiter: Option<String>,
  pub quote: Option<String>,
  pub compression: Option<String>,
  pub compression_level: Option<i32>,
  /// When true, write a JSON array; otherwise NDJSON (one object per line).
  pub json_array: Option<bool>,
}

fn parse_delimiter_byte(s: &str) -> u8 {
  match s {
    "\\t" | "\t" | "tab" | "TAB" => b'\t',
    other if !other.is_empty() => other.as_bytes()[0],
    _ => b',',
  }
}

fn parse_quote_byte(s: &str) -> u8 {
  if s.is_empty() {
    b'"'
  } else {
    s.as_bytes()[0]
  }
}

fn parquet_compression(
  name: &str,
  level: Option<i32>,
) -> anyhow::Result<Compression> {
  let lower = name.to_ascii_lowercase();
  Ok(match lower.as_str() {
    "uncompressed" | "none" => Compression::UNCOMPRESSED,
    "snappy" => Compression::SNAPPY,
    "gzip" => Compression::GZIP(GzipLevel::try_new(level.unwrap_or(6) as u32)?),
    "brotli" => Compression::BROTLI(BrotliLevel::try_new(level.unwrap_or(4) as u32)?),
    "lz4" | "lz4_raw" => Compression::LZ4_RAW,
    "zstd" => Compression::ZSTD(ZstdLevel::try_new(level.unwrap_or(3))?),
    other => {
      return Err(anyhow!("unsupported parquet compression: {other}"));
    }
  })
}

pub fn write_csv(
  file: &str,
  batch: &RecordBatch,
  options: &ExportOptions,
) -> anyhow::Result<()> {
  let file = File::create(file)?;
  let header = options.header.unwrap_or(true);
  let delimiter = options
    .delimiter
    .as_deref()
    .map(parse_delimiter_byte)
    .unwrap_or(b',');
  let mut builder = WriterBuilder::new()
    .with_header(header)
    .with_delimiter(delimiter);
  if let Some(quote) = options.quote.as_deref() {
    builder = builder.with_quote(parse_quote_byte(quote));
  }
  let mut writer = builder.build(file);
  writer.write(batch)?;
  Ok(())
}

pub fn write_parquet(
  file: &str,
  batch: &RecordBatch,
  options: &ExportOptions,
) -> anyhow::Result<()> {
  let file = File::create(file)?;
  let compression = parquet_compression(
    options.compression.as_deref().unwrap_or("zstd"),
    options.compression_level,
  )?;
  let props = WriterProperties::builder()
    .set_compression(compression)
    .build();
  let mut writer = ArrowWriter::try_new(file, batch.schema(), Some(props))?;
  writer.write(batch)?;
  writer.close()?;
  Ok(())
}

pub fn write_json(
  file: &str,
  batch: &RecordBatch,
  options: &ExportOptions,
) -> anyhow::Result<()> {
  let schema = batch.schema();
  let fmt_options = FormatOptions::default();
  let formatters = batch
    .columns()
    .iter()
    .map(|col| arrow::util::display::ArrayFormatter::try_new(col.as_ref(), &fmt_options))
    .collect::<Result<Vec<_>, _>>()?;

  let mut rows = Vec::with_capacity(batch.num_rows());
  for row_idx in 0..batch.num_rows() {
    let mut obj = serde_json::Map::new();
    for (col_idx, field) in schema.fields().iter().enumerate() {
      if batch.column(col_idx).is_null(row_idx) {
        obj.insert(field.name().clone(), serde_json::Value::Null);
      } else {
        let text = formatters[col_idx].value(row_idx).to_string();
        obj.insert(field.name().clone(), serde_json::Value::String(text));
      }
    }
    rows.push(serde_json::Value::Object(obj));
  }

  let mut out = File::create(file)?;
  if options.json_array.unwrap_or(true) {
    serde_json::to_writer_pretty(&mut out, &rows)?;
  } else {
    for row in rows {
      serde_json::to_writer(&mut out, &row)?;
      out.write_all(b"\n")?;
    }
  }
  Ok(())
}

pub fn write_xlsx(file: &str, batch: &RecordBatch) -> Result<()> {
  // 1. 创建一个新的 Excel 工作簿和工作表
  let mut workbook = Workbook::new();
  let worksheet = workbook.add_worksheet();
  let schema = batch.schema();

  // 2. 逐列处理
  for (col_idx, (field, column_array)) in schema.fields().iter().zip(batch.columns()).enumerate() {
    // Excel 列索引是 u16 类型
    let xlsx_col = col_idx as u16;

    // 写入表头
    worksheet.write_string(0, xlsx_col, field.name())?;

    // 核心逻辑：将整个 Arrow Array 转换为 Vec<T>，然后使用 write_column 一次性写入。
    // 我们从第 1 行开始写入数据（第 0 行是表头）。
    let start_row = 1;

    match column_array.data_type() {
      DataType::Boolean => {
        let array = column_array
          .as_any()
          .downcast_ref::<BooleanArray>()
          .unwrap();
        // .iter() 产生 Iterator<Item = Option<bool>>，正是 write_column 所需的
        worksheet.write_column(start_row, xlsx_col, array.iter())?;
      }
      // --- 回退机制 ---
      _ => {
        let options = FormatOptions::default();
        let formatter =
          arrow::util::display::ArrayFormatter::try_new(column_array.as_ref(), &options)?;
        let data: Vec<String> = (0..column_array.len())
          .map(|i| formatter.value(i).to_string())
          .collect();
        worksheet.write_column(start_row, xlsx_col, &data)?;
      }
    }
  }

  // 3. 保存工作簿
  workbook
    .save(file)
    .map_err(|e| anyhow!("Failed to save XLSX file: {}", e))?;

  log::debug!("Successfully wrote data to {}", file);
  Ok(())
}

pub fn batch_write(
  file: &str,
  batch: &RecordBatch,
  format: &str,
  options: &ExportOptions,
) -> anyhow::Result<()> {
  match format {
    "csv" => write_csv(file, batch, options)?,
    "tsv" => {
      let mut opts = options.clone();
      if opts.delimiter.is_none() {
        opts.delimiter = Some("\t".to_string());
      }
      write_csv(file, batch, &opts)?;
    }
    "json" => write_json(file, batch, options)?,
    "parquet" => write_parquet(file, batch, options)?,
    "xlsx" => write_xlsx(file, batch)?,
    other => return Err(anyhow!("unsupported export format: {other}")),
  }
  Ok(())
}

/// Whether format supports multi-batch streaming export (not xlsx).
pub fn format_supports_streaming(format: &str) -> bool {
  matches!(
    format.to_ascii_lowercase().as_str(),
    "csv" | "tsv" | "json" | "parquet"
  )
}

/// Streaming multi-batch writer for large exports without holding all rows.
pub struct StreamExporter {
  format: String,
  options: ExportOptions,
  first: bool,
  csv_writer: Option<arrow::csv::Writer<File>>,
  parquet_writer: Option<ArrowWriter<File>>,
  json_file: Option<File>,
  json_array: bool,
  json_opened: bool,
  path: String,
}

impl StreamExporter {
  pub fn create(file: &str, format: &str, options: &ExportOptions) -> anyhow::Result<Self> {
    let format = format.to_ascii_lowercase();
    if !format_supports_streaming(&format) {
      return Err(anyhow!(
        "format '{format}' does not support streaming export; use single-batch export"
      ));
    }
    Ok(Self {
      format,
      options: options.clone(),
      first: true,
      csv_writer: None,
      parquet_writer: None,
      json_file: None,
      json_array: options.json_array.unwrap_or(true),
      json_opened: false,
      path: file.to_string(),
    })
  }

  pub fn write_batch(&mut self, batch: &RecordBatch) -> anyhow::Result<()> {
    if batch.num_rows() == 0 && !self.first {
      return Ok(());
    }
    match self.format.as_str() {
      "csv" | "tsv" => self.write_csv_batch(batch),
      "parquet" => self.write_parquet_batch(batch),
      "json" => self.write_json_batch(batch),
      other => Err(anyhow!("unsupported streaming format: {other}")),
    }
  }

  fn csv_writer_builder(options: &ExportOptions, format: &str, header: bool) -> WriterBuilder {
    let mut opts = options.clone();
    if format == "tsv" && opts.delimiter.is_none() {
      opts.delimiter = Some("\t".to_string());
    }
    let delimiter = opts
      .delimiter
      .as_deref()
      .map(parse_delimiter_byte)
      .unwrap_or(b',');
    let mut builder = WriterBuilder::new()
      .with_header(header)
      .with_delimiter(delimiter);
    if let Some(quote) = opts.quote.as_deref() {
      builder = builder.with_quote(parse_quote_byte(quote));
    }
    builder
  }

  fn write_csv_batch(&mut self, batch: &RecordBatch) -> anyhow::Result<()> {
    if self.first {
      let file = File::create(&self.path)?;
      let header = self.options.header.unwrap_or(true);
      let builder = Self::csv_writer_builder(&self.options, &self.format, header);
      let mut writer = builder.build(file);
      writer.write(batch)?;
      // Drop to flush; subsequent batches append without header.
      drop(writer);
      self.first = false;
      return Ok(());
    }

    let file = std::fs::OpenOptions::new()
      .append(true)
      .open(&self.path)?;
    let builder = Self::csv_writer_builder(&self.options, &self.format, false);
    let mut writer = builder.build(file);
    writer.write(batch)?;
    Ok(())
  }

  fn write_parquet_batch(&mut self, batch: &RecordBatch) -> anyhow::Result<()> {
    if self.parquet_writer.is_none() {
      let file = File::create(&self.path)?;
      let compression = parquet_compression(
        self.options.compression.as_deref().unwrap_or("zstd"),
        self.options.compression_level,
      )?;
      let props = WriterProperties::builder()
        .set_compression(compression)
        .build();
      self.parquet_writer = Some(ArrowWriter::try_new(
        file,
        batch.schema(),
        Some(props),
      )?);
    }
    if let Some(w) = self.parquet_writer.as_mut() {
      w.write(batch)?;
    }
    self.first = false;
    Ok(())
  }

  fn write_json_batch(&mut self, batch: &RecordBatch) -> anyhow::Result<()> {
    if self.json_file.is_none() {
      let mut f = File::create(&self.path)?;
      if self.json_array {
        f.write_all(b"[\n")?;
      }
      self.json_file = Some(f);
      self.json_opened = true;
    }
    let schema = batch.schema();
    let fmt_options = FormatOptions::default();
    let formatters = batch
      .columns()
      .iter()
      .map(|col| arrow::util::display::ArrayFormatter::try_new(col.as_ref(), &fmt_options))
      .collect::<Result<Vec<_>, _>>()?;

    let file = self
      .json_file
      .as_mut()
      .ok_or_else(|| anyhow!("json export file missing"))?;

    for row_idx in 0..batch.num_rows() {
      if self.json_array && !self.first {
        file.write_all(b",\n")?;
      }
      let mut obj = serde_json::Map::new();
      for (col_idx, field) in schema.fields().iter().enumerate() {
        if batch.column(col_idx).is_null(row_idx) {
          obj.insert(field.name().clone(), serde_json::Value::Null);
        } else {
          let text = formatters[col_idx].value(row_idx).to_string();
          obj.insert(field.name().clone(), serde_json::Value::String(text));
        }
      }
      serde_json::to_writer(&mut *file, &serde_json::Value::Object(obj))?;
      if !self.json_array {
        file.write_all(b"\n")?;
      }
      self.first = false;
    }
    Ok(())
  }

  pub fn finish(mut self) -> anyhow::Result<()> {
    if let Some(w) = self.parquet_writer.take() {
      w.close()?;
    }
    self.csv_writer.take();
    if let Some(mut f) = self.json_file.take() {
      if self.json_array && self.json_opened {
        if self.first {
          f.write_all(b"]")?;
        } else {
          f.write_all(b"\n]")?;
        }
      }
      f.flush()?;
    } else if self.first {
      // No rows written: still create an empty artifact for csv/tsv.
      if matches!(self.format.as_str(), "csv" | "tsv") {
        let _ = File::create(&self.path)?;
      }
    }
    Ok(())
  }
}

/// Default page size for LIMIT/OFFSET batched export.
pub const EXPORT_BATCH_ROWS: usize = 5_000;

#[cfg(test)]
mod stream_export_tests {
  use super::*;
  use arrow::array::{Int64Array, StringArray};
  use std::sync::Arc;

  fn sample_batch(start: i64, n: usize) -> RecordBatch {
    let ids: Vec<i64> = (start..start + n as i64).collect();
    let names: Vec<String> = ids.iter().map(|i| format!("n{i}")).collect();
    let schema = Arc::new(Schema::new(vec![
      Field::new("id", DataType::Int64, false),
      Field::new("name", DataType::Utf8, false),
    ]));
    RecordBatch::try_new(
      schema,
      vec![
        Arc::new(Int64Array::from(ids)),
        Arc::new(StringArray::from(names)),
      ],
    )
    .unwrap()
  }

  #[test]
  fn stream_csv_multiple_batches() {
    let dir = std::env::temp_dir().join(format!("duckling_stream_{}", nanoid::nanoid!(6)));
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("out.csv");
    let path_str = path.to_str().unwrap();
    let opts = ExportOptions {
      header: Some(true),
      ..Default::default()
    };
    let mut exp = StreamExporter::create(path_str, "csv", &opts).unwrap();
    exp.write_batch(&sample_batch(1, 2)).unwrap();
    exp.write_batch(&sample_batch(3, 2)).unwrap();
    exp.finish().unwrap();
    let content = std::fs::read_to_string(&path).unwrap();
    assert!(content.contains("n1"));
    assert!(content.contains("n4"));
    // header line once
    let header_hits = content
      .lines()
      .filter(|l| l.contains("id") && l.contains("name"))
      .count();
    assert_eq!(header_hits, 1, "expected single header line, got:\n{content}");
    let _ = std::fs::remove_dir_all(&dir);
  }

  #[test]
  fn stream_json_array_batches() {
    let dir = std::env::temp_dir().join(format!("duckling_stream_j_{}", nanoid::nanoid!(6)));
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("out.json");
    let path_str = path.to_str().unwrap();
    let opts = ExportOptions {
      json_array: Some(true),
      ..Default::default()
    };
    let mut exp = StreamExporter::create(path_str, "json", &opts).unwrap();
    exp.write_batch(&sample_batch(1, 1)).unwrap();
    exp.write_batch(&sample_batch(2, 1)).unwrap();
    exp.finish().unwrap();
    let content = std::fs::read_to_string(&path).unwrap();
    let v: serde_json::Value = serde_json::from_str(&content).unwrap();
    assert!(v.is_array());
    assert_eq!(v.as_array().unwrap().len(), 2);
    let _ = std::fs::remove_dir_all(&dir);
  }

  #[test]
  fn format_supports_streaming_flags() {
    assert!(format_supports_streaming("csv"));
    assert!(format_supports_streaming("parquet"));
    assert!(!format_supports_streaming("xlsx"));
  }
}

pub fn date_to_days(t: &NaiveDate) -> i32 {
  t.signed_duration_since(NaiveDate::from_ymd_opt(1970, 1, 1).unwrap())
    .num_days() as i32
}

pub fn json_to_arrow<S: Serialize>(rows: &[S], schema: SchemaRef) -> anyhow::Result<RecordBatch> {
  let mut decoder = ReaderBuilder::new(schema).build_decoder()?;
  decoder.serialize(rows)?;
  let batch = decoder.flush()?.unwrap();
  Ok(batch)
}

pub fn serialize_preview(record: &RecordBatch) -> Result<Vec<u8>, arrow::error::ArrowError> {
  let mut writer = StreamWriter::try_new(Vec::new(), &record.schema())?;
  writer.write(record)?;
  writer.into_inner()
}
