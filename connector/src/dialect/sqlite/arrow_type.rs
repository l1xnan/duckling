use arrow::array::{
  ArrayBuilder, ArrayRef, BooleanBuilder, Float64Builder, Int64Builder, LargeBinaryBuilder,
  StringBuilder,
};
use arrow::datatypes::{DataType, Field, Schema};
use arrow::record_batch::RecordBatch;
use itertools::izip;
use rusqlite::{types::Value, Connection, Statement};
use std::sync::Arc;

pub fn db_to_arrow_type(decl_type: Option<&str>) -> DataType {
  // https://sqlite.org/datatype3.html#determination_of_column_affinity
  if let Some(decl_type) = decl_type {
    match decl_type {
      // INT, INTEGER
      ty if ty.contains("INT") => DataType::Int64,
      ty if ty.contains("REAL") || ty.contains("DOUB") || ty.contains("FLOA") => DataType::Float64,
      // VARCHAR, NVARCHAR, TEXT, CLOB
      ty if ty.contains("CHAR") || ty.contains("CLOB") || ty.contains("TEXT") => DataType::Utf8,
      ty if ty.contains("NUMERIC") => DataType::Utf8,
      ty if ty.contains("BLOB") => DataType::LargeBinary,
      "DATE" | "DATETIME" | "TIME" => DataType::Utf8,
      "BOOLEAN" => DataType::Boolean,
      // "NULL" => DataType::Null,
      _ => DataType::Utf8,
    }
  } else {
    DataType::Utf8
  }
}

fn make_builder(data_type: &DataType) -> Box<dyn ArrayBuilder> {
  match data_type {
    DataType::Int64 => Box::new(Int64Builder::new()),
    DataType::LargeBinary => Box::new(LargeBinaryBuilder::new()),
    DataType::Utf8 => Box::new(StringBuilder::new()),
    DataType::Float64 => Box::new(Float64Builder::new()),
    DataType::Boolean => Box::new(BooleanBuilder::new()),
    _ => Box::new(StringBuilder::new()),
  }
}

pub fn db_result_to_arrow(stmt: &mut Statement) -> anyhow::Result<RecordBatch> {
  // 获取列的数据类型映射（这里简单处理几种常见类型，可根据实际扩展）
  let data_types: Vec<DataType> = stmt
    .columns()
    .iter()
    .map(|col| db_to_arrow_type(col.decl_type()))
    .collect();

  let fields: Vec<Field> = izip!(stmt.column_names(), data_types.clone())
    .map(|(name, data_type)| Field::new(name, data_type.clone(), true))
    .collect();

  let schema = Arc::new(Schema::new(fields));

  let mut builders: Vec<Box<dyn ArrayBuilder>> = data_types.iter().map(make_builder).collect();

  let mut rows = stmt.query([])?;
  while let Some(row) = rows.next()? {
    for (idx, data_type) in data_types.iter().enumerate() {
      let val = row.get::<_, Value>(idx).unwrap_or(Value::Null);
      match data_type {
        DataType::Int64 => {
          let value = row.get::<usize, Option<i64>>(idx).unwrap_or(None);
          builders[idx]
            .as_any_mut()
            .downcast_mut::<Int64Builder>()
            .unwrap()
            .append_option(value);
        }
        DataType::Float64 => {
          let value = row.get::<usize, Option<f64>>(idx).unwrap_or(None);
          builders[idx]
            .as_any_mut()
            .downcast_mut::<Float64Builder>()
            .unwrap()
            .append_option(value);
        }
        DataType::Utf8 => {
          let value = convert_to_string(&val);
          builders[idx]
            .as_any_mut()
            .downcast_mut::<StringBuilder>()
            .unwrap()
            .append_option(value);
        }
        DataType::Boolean => {
          let value = row.get::<usize, Option<bool>>(idx).unwrap_or(None);
          builders[idx]
            .as_any_mut()
            .downcast_mut::<BooleanBuilder>()
            .unwrap()
            .append_option(value);
        }
        DataType::LargeBinary => {
          let value = row.get::<usize, Option<Vec<u8>>>(idx).unwrap_or(None);
          builders[idx]
            .as_any_mut()
            .downcast_mut::<LargeBinaryBuilder>()
            .unwrap()
            .append_option(value);
        }
        _ => {}
      }
    }
  }
  let mut columns: Vec<ArrayRef> = Vec::new();
  for mut builder in builders {
    columns.push(builder.finish());
  }

  Ok(RecordBatch::try_new(schema, columns)?)
}

#[allow(dead_code)]
pub fn convert_to_string(value: &Value) -> Option<String> {
  match value {
    Value::Integer(i) => Some(i.to_string()),
    Value::Real(f) => Some(f.to_string()),
    Value::Text(s) => Some(s.clone()),
    Value::Blob(b) => String::from_utf8(b.clone()).ok(),
    Value::Null => None::<String>,
  }
}

fn test() {
  let conn = Connection::open("test.db").unwrap();
  let sql = "SELECT * FROM your_table";
  let mut stmt = conn.prepare(sql).unwrap();
  match db_result_to_arrow(&mut stmt) {
    Ok(record_batch) => println!("RecordBatch: {:?}", record_batch),
    Err(e) => println!("error: {}", e),
  }
}
