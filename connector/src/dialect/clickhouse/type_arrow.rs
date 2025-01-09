use crate::utils::date_to_days;
use arrow::array::types;
use arrow::array::*;
use arrow::array::{ArrayRef, Date32Array, Date64Array, StringArray, UInt8Array};
use arrow::datatypes::Field;
use arrow::datatypes::*;
use chrono::{DateTime, NaiveDate};
use chrono_tz::Tz;
use clickhouse_rs::types::{Column, Complex, Decimal, SqlType};
use clickhouse_rs::Block;
use std::sync::Arc;

macro_rules! generate_array {
  ($col:expr, $ty:ty, $nav:ty, $nullable:expr) => {
    Arc::new(if $nullable {
      let values: Vec<_> = $col.iter::<Option<$nav>>()?.map(|x| x.cloned()).collect();
      <$ty>::from(values)
    } else {
      let values: Vec<_> = $col.iter::<$nav>()?.copied().collect();
      <$ty>::from(values)
    })
  };
}

macro_rules! generate_list_array {
  ($col:expr, $ty:ty, $nav:ty) => {
    Arc::new(ListArray::from_iter_primitive::<$ty, _, _>(
      $col
        .iter::<Vec<$nav>>()?
        .map(|x| Some(x.into_iter().map(|y| Some(*y)).collect::<Vec<_>>()))
        .collect::<Vec<_>>(),
    ))
  };
}

pub(crate) fn block_to_arrow(block: &Block<Complex>) -> anyhow::Result<RecordBatch> {
  let mut fields = vec![];
  let mut data = vec![];
  for col in block.columns() {
    let (field, arr) = convert_col(col, &col.sql_type())?;
    fields.push(field);
    data.push(arr);
  }

  let schema = Schema::new(fields);
  let batch = RecordBatch::try_new(Arc::new(schema), data)?;
  Ok(batch)
}

pub fn convert_col(col: &Column<Complex>, col_type: &SqlType) -> anyhow::Result<(Field, ArrayRef)> {
  let nullable = matches!(col_type, SqlType::Nullable(_));
  let typ = if let SqlType::Nullable(t) = col_type {
    *t
  } else {
    col_type
  };
  let field = Field::new(col.name(), convert_type(typ), nullable);
  let arr: ArrayRef = match typ {
    SqlType::UInt8 => generate_array!(col, UInt8Array, u8, nullable),
    SqlType::UInt16 => generate_array!(col, UInt16Array, u16, nullable),
    SqlType::UInt32 => generate_array!(col, UInt32Array, u32, nullable),
    SqlType::UInt64 => generate_array!(col, UInt64Array, u64, nullable),
    SqlType::Int8 => generate_array!(col, Int8Array, i8, nullable),
    SqlType::Int16 => generate_array!(col, Int16Array, i16, nullable),
    SqlType::Int32 => generate_array!(col, Int32Array, i32, nullable),
    SqlType::Int64 => generate_array!(col, Int64Array, i64, nullable),
    SqlType::Float32 => generate_array!(col, Float32Array, f32, nullable),
    SqlType::Float64 => generate_array!(col, Float64Array, f64, nullable),
    SqlType::Date => Arc::new(if nullable {
      let values: Vec<_> = col
        .iter::<Option<NaiveDate>>()?
        .map(|t| t.map(|tt| date_to_days(&tt)))
        .collect();
      Date32Array::from(values)
    } else {
      let values: Vec<_> = col.iter::<NaiveDate>()?.map(|t| date_to_days(&t)).collect();
      Date32Array::from(values)
    }),
    SqlType::DateTime(_) => Arc::new(if nullable {
      let values: Vec<_> = col
        .iter::<Option<DateTime<Tz>>>()?
        .map(|x| x.map(|i| i.timestamp() * 1000))
        .collect();
      Date64Array::from(values)
    } else {
      let values: Vec<_> = col
        .iter::<DateTime<Tz>>()?
        .map(|t| t.timestamp() * 1000)
        .collect();
      Date64Array::from(values)
    }),
    SqlType::Decimal(_d1, _d2) => Arc::new(if nullable {
      StringArray::from(
        col
          .iter::<Option<Decimal>>()?
          .map(|t| t.map(|i| format!("{i}")))
          .collect::<Vec<_>>(),
      )
    } else {
      StringArray::from(
        col
          .iter::<Decimal>()?
          .map(|t| format!("{t}"))
          .collect::<Vec<_>>(),
      )
    }),
    SqlType::Array(t) => match t {
      SqlType::Int32 => generate_list_array!(col, types::Int32Type, i32),
      SqlType::Int64 => generate_list_array!(col, types::Int64Type, i64),
      SqlType::Float32 => generate_list_array!(col, types::Float32Type, f32),
      SqlType::Float64 => generate_list_array!(col, types::Float64Type, f64),
      _ => Arc::new(ListArray::from_iter_primitive::<types::UInt8Type, _, _>(
        col
          .iter::<Vec<u8>>()?
          .map(|x| Some(x.into_iter().map(|y| Some(*y)).collect::<Vec<_>>()))
          .collect::<Vec<_>>(),
      )),
    },
    _ => {
      let strings: Vec<_> = if nullable {
        col
          .iter::<Option<&[u8]>>()?
          .map(|s| s.and_then(|b| std::str::from_utf8(b).ok()))
          .collect()
      } else {
        col
          .iter::<&[u8]>()?
          .map(|s| std::str::from_utf8(s).ok())
          .collect()
      };
      Arc::new(StringArray::from(strings))
    }
  };
  Ok((field, arr))
}

fn convert_type(col_type: &SqlType) -> DataType {
  match col_type {
    SqlType::Bool => DataType::Boolean,
    SqlType::UInt8 => DataType::UInt8,
    SqlType::UInt16 => DataType::UInt16,
    SqlType::UInt32 => DataType::UInt32,
    SqlType::UInt64 => DataType::UInt64,
    SqlType::Int8 => DataType::Int8,
    SqlType::Int16 => DataType::Int16,
    SqlType::Int32 => DataType::Int32,
    SqlType::Int64 => DataType::Int64,
    SqlType::Float32 => DataType::Float32,
    SqlType::Float64 => DataType::Float64,
    SqlType::Date => DataType::Date32,
    SqlType::String => DataType::Utf8,
    SqlType::DateTime(_) => DataType::Date64,
    SqlType::Nullable(t) => crate::dialect::clickhouse::convert_type(t),
    SqlType::Decimal(_d1, _d2) => DataType::Utf8,
    SqlType::Array(t) => DataType::List(Arc::new(Field::new(
      "item",
      crate::dialect::clickhouse::convert_type(t),
      true,
    ))),
    _ => DataType::Utf8,
  }
}
