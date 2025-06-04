use arrow::datatypes::{DataType, Field};
use std::sync::Arc;
use tokio_postgres::Column;
use tokio_postgres::types::Type;

pub fn col_to_arrow_type(column: &Column) -> DataType {
  match *column.type_() {
    // for rust-postgres <> postgres type-mappings: https://docs.rs/postgres/latest/postgres/types/trait.FromSql.html#types
    // for postgres types: https://www.postgresql.org/docs/7.4/datatype.html#DATATYPE-TABLE

    // single types
    Type::BOOL => DataType::Boolean,
    Type::INT2 => DataType::Int64,
    Type::INT4 => DataType::Int64,
    Type::INT8 => DataType::Int64,
    Type::TEXT | Type::VARCHAR => DataType::Utf8,
    Type::JSON | Type::JSONB => DataType::Utf8,
    Type::FLOAT4 => DataType::Float64,
    Type::FLOAT8 => DataType::Float64,
    Type::NUMERIC => DataType::Utf8,
    // these types require a custom StringCollector struct as an intermediary (see struct at bottom)
    Type::TS_VECTOR => DataType::Utf8,

    Type::DATE => DataType::Utf8,
    Type::TIMESTAMP => DataType::Utf8,

    // array types
    Type::BOOL_ARRAY => DataType::Utf8,
    Type::INT2_ARRAY => DataType::Utf8,
    Type::INT4_ARRAY => DataType::Utf8,
    Type::INT8_ARRAY => DataType::Utf8,
    Type::BYTEA => DataType::Binary,
    Type::TEXT_ARRAY | Type::VARCHAR_ARRAY => {
      DataType::List(Arc::new(Field::new("", DataType::Utf8, true)))
    }
    Type::JSON_ARRAY | Type::JSONB_ARRAY => DataType::Utf8,
    Type::FLOAT4_ARRAY => DataType::Utf8,
    Type::FLOAT8_ARRAY => DataType::Utf8,
    // these types require a custom StringCollector struct as an intermediary (see struct at bottom)
    Type::TS_VECTOR_ARRAY => DataType::Utf8,

    Type::ANYENUM => DataType::Utf8,
    _ => DataType::Utf8,
  }
}
