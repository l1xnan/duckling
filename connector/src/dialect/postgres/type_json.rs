use anyhow::{Context, anyhow};
use rust_decimal::Decimal;
use serde_json::{Map, json};
use tokio_postgres::types::{FromSql, Type};
use tokio_postgres::{Column, Row};

pub type JSONValue = serde_json::Value;
pub type RowData = Map<String, JSONValue>;
pub type Error = anyhow::Error;

#[inline]
fn try_convert<'a, T>(row: &'a Row, idx: usize) -> Result<JSONValue, Error>
where
  T: FromSql<'a> + serde::Serialize,
{
  Ok(json!(row.try_get::<_, Option<T>>(idx)?))
}

fn get_basic<'a, T: FromSql<'a>>(
  row: &'a Row,
  column: &Column,
  column_i: usize,
  val_to_json_val: impl Fn(T) -> Result<JSONValue, Error>,
) -> Result<JSONValue, Error> {
  let raw_val = row
    .try_get::<_, Option<T>>(column_i)
    .with_context(|| format!("column_name:{}", column.name()))?;
  raw_val.map_or(Ok(JSONValue::Null), val_to_json_val)
}

pub fn pg_cell_to_json_value(
  row: &Row,
  column: &Column,
  column_i: usize,
) -> Result<JSONValue, Error> {
  let f64_to_json_number = |raw_val: f64| -> Result<JSONValue, Error> {
    let temp = serde_json::Number::from_f64(raw_val).ok_or(anyhow!("invalid json-float"))?;
    Ok(JSONValue::Number(temp))
  };
  Ok(match *column.type_() {
    // for rust-postgres <> postgres type-mappings: https://docs.rs/postgres/latest/postgres/types/trait.FromSql.html#types
    // for postgres types: https://www.postgresql.org/docs/7.4/datatype.html#DATATYPE-TABLE

    // single types
    Type::BOOL => get_basic(row, column, column_i, |a: bool| Ok(json!(a)))?,
    Type::INT2 => get_basic(row, column, column_i, |a: i16| Ok(json!(a)))?,
    Type::INT4 => get_basic(row, column, column_i, |a: i32| Ok(json!(a)))?,
    Type::INT8 => get_basic(row, column, column_i, |a: i64| Ok(json!(a)))?,
    Type::TEXT | Type::VARCHAR => get_basic(row, column, column_i, |a: String| Ok(json!(a)))?,
    Type::JSON | Type::JSONB => get_basic(row, column, column_i, |a: JSONValue| Ok(a))?,
    Type::FLOAT4 => get_basic(row, column, column_i, |a: f32| Ok(json!(a)))?,
    Type::FLOAT8 => get_basic(row, column, column_i, |a: f64| Ok(json!(a)))?,
    Type::NUMERIC => try_convert::<Decimal>(row, column_i)?,
    // these types require a custom StringCollector struct as an intermediary (see struct at bottom)
    Type::TS_VECTOR => get_basic(row, column, column_i, |a: StringCollector| Ok(json!(a.0)))?,
    Type::DATE => {
      let date: chrono::NaiveDate = row.get(column_i);
      json!(date.to_string())
    }
    Type::TIME => get_basic(row, column, column_i, |a: StringCollector| Ok(json!(a.0)))?,
    Type::BYTEA => {
      let mut arr = vec![];
      let v: &[u8] = row.get(column_i);
      if v.is_empty() {
        JSONValue::Null
      } else {
        for u in v {
          arr.push(JSONValue::Number(serde_json::Number::from(*u)));
        }
        JSONValue::Array(arr)
      }
    }
    Type::TIMESTAMP => try_convert::<String>(row, column_i)?,
    // array types
    Type::BOOL_ARRAY => get_array(row, column, column_i, |a: bool| Ok(JSONValue::Bool(a)))?,
    Type::INT2_ARRAY => get_array(row, column, column_i, |a: i16| {
      Ok(JSONValue::Number(serde_json::Number::from(a)))
    })?,
    Type::INT4_ARRAY => get_array(row, column, column_i, |a: i32| {
      Ok(JSONValue::Number(serde_json::Number::from(a)))
    })?,
    Type::INT8_ARRAY => get_array(row, column, column_i, |a: i64| {
      Ok(JSONValue::Number(serde_json::Number::from(a)))
    })?,
    Type::TEXT_ARRAY | Type::VARCHAR_ARRAY => {
      get_array(row, column, column_i, |a: String| Ok(JSONValue::String(a)))?
    }
    Type::JSON_ARRAY | Type::JSONB_ARRAY => get_array(row, column, column_i, |a: JSONValue| Ok(a))?,
    Type::FLOAT4_ARRAY => get_array(row, column, column_i, |a: f32| f64_to_json_number(a.into()))?,
    Type::FLOAT8_ARRAY => get_array(row, column, column_i, |a: f64| f64_to_json_number(a))?,
    // these types require a custom StringCollector struct as an intermediary (see struct at bottom)
    Type::TS_VECTOR_ARRAY => get_array(row, column, column_i, |a: StringCollector| Ok(json!(a.0)))?,

    Type::ANYENUM => {
      let val: GenericEnum = row.get(column_i);
      json!(val.0)
    }
    _ => {
      log::warn!(
        "Cannot convert pg-cell \"{}\" of type \"{}\" to a JSONValue.",
        column.name(),
        column.type_().name()
      );
      println!(
        "{}={}, {:?}",
        column.type_().name(),
        column.type_().oid(),
        column.type_().kind()
      );
      let val: GenericEnum = row.get(column_i);
      JSONValue::String(val.0)
    }
  })
}

pub fn postgres_row_to_json_value(row: Row) -> Result<JSONValue, Error> {
  let row_data = postgres_row_to_row_data(row)?;
  Ok(JSONValue::Object(row_data))
}

pub fn postgres_row_to_row_data(row: Row) -> Result<RowData, Error> {
  let mut result: RowData = Map::new();
  for (i, column) in row.columns().iter().enumerate() {
    let name = column.name();
    let json_value = pg_cell_to_json_value(&row, column, i)?;
    result.insert(name.to_string(), json_value);
  }
  Ok(result)
}

fn get_array<'a, T: FromSql<'a>>(
  row: &'a Row,
  column: &Column,
  column_i: usize,
  val_to_json_val: impl Fn(T) -> Result<JSONValue, Error>,
) -> Result<JSONValue, Error> {
  let raw_val_array = row
    .try_get::<_, Option<Vec<T>>>(column_i)
    .with_context(|| format!("column_name:{}", column.name()))?;
  Ok(match raw_val_array {
    Some(val_array) => {
      let mut result = vec![];
      for val in val_array {
        result.push(val_to_json_val(val)?);
      }
      JSONValue::Array(result)
    }
    None => JSONValue::Null,
  })
}

// you can remove this section if not using TS_VECTOR (or other types requiring an intermediary `FromSQL` struct)
struct StringCollector(String);

impl FromSql<'_> for StringCollector {
  fn from_sql(
    _: &Type,
    raw: &[u8],
  ) -> Result<StringCollector, Box<dyn std::error::Error + Sync + Send>> {
    let result = std::str::from_utf8(raw)?;
    Ok(StringCollector(result.to_owned()))
  }
  fn accepts(_ty: &Type) -> bool {
    true
  }
}

#[derive(Debug)]
struct GenericEnum(String);

impl FromSql<'_> for GenericEnum {
  fn from_sql(
    _: &Type,
    raw: &[u8],
  ) -> Result<GenericEnum, Box<dyn std::error::Error + Sync + Send>> {
    let result = std::str::from_utf8(raw).unwrap();
    let val = GenericEnum(result.to_owned());
    Ok(val)
  }
  fn accepts(_ty: &Type) -> bool {
    true
  }
}
