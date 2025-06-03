use mysql::consts::ColumnType;
// Import the ColumnType enum
use mysql::{QueryResult, Text, Value as MysqlValue};
use serde_json::{json, Map, Number, Value as JsonValue};
// For Arc<[Column]>

pub fn mysql_value_to_json_value_detailed(
  mysql_val: &MysqlValue,
  col_type: ColumnType,
) -> JsonValue {
  match mysql_val {
    MysqlValue::NULL => JsonValue::Null, // Handles MYSQL_TYPE_NULL implicitly

    MysqlValue::Bytes(bytes) => {
      // This is where ColumnType hint is most crucial
      match col_type {
        ColumnType::MYSQL_TYPE_JSON => {
          // Attempt to parse the bytes as a JSON string into a serde_json::Value
          serde_json::from_slice(bytes).unwrap_or_else(|_| {
            // Fallback: if parsing fails, return as a string (might be malformed JSON)
            JsonValue::String(String::from_utf8_lossy(bytes).into_owned())
          })
        }
        ColumnType::MYSQL_TYPE_BIT => {
          if bytes.is_empty() {
            JsonValue::Null // Or perhaps json!(0) or an empty string based on preference
          } else if bytes.len() == 1 {
            // For BIT(1) to BIT(8), treat as a number.
            // BIT(1) will be 0 or 1.
            json!(bytes[0] as u64)
          } else if bytes.len() <= 8 {
            // For BIT(9) to BIT(64), interpret bytes as a big-endian u64.
            let mut val: u64 = 0;
            for &byte in bytes.iter() {
              val = (val << 8) | (byte as u64);
            }
            json!(val)
          } else {
            // For BIT fields > 64 bits, a hex string is a common representation.
            // Or, you could use a library that handles large integers (e.g., num_bigint).
            JsonValue::String(format!(
              "0x{}",
              bytes
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect::<String>()
            ))
          }
        }
        ColumnType::MYSQL_TYPE_SET => {
          // SET values are comma-separated strings
          let s = String::from_utf8_lossy(bytes);
          JsonValue::Array(
            s.split(',')
              .map(|item| JsonValue::String(item.trim().to_string()))
              .filter(|jv| jv.as_str().map_or(false, |s| !s.is_empty())) // Remove empty strings if any
              .collect(),
          )
        }
        ColumnType::MYSQL_TYPE_ENUM => {
          JsonValue::String(String::from_utf8_lossy(bytes).into_owned())
        }
        ColumnType::MYSQL_TYPE_DECIMAL | ColumnType::MYSQL_TYPE_NEWDECIMAL => {
          // DECIMAL types are usually transferred as strings to maintain precision.
          JsonValue::String(String::from_utf8_lossy(bytes).into_owned())
        }
        ColumnType::MYSQL_TYPE_GEOMETRY => {
          // Geometry data could be Well-Known Text (WKT) or Well-Known Binary (WKB).
          // If WKT, from_utf8_lossy is fine. If WKB, it's binary.
          // For simplicity here, we assume it's representable as a string (e.g., WKT or hex of WKB).
          // A more advanced handler might convert WKB to GeoJSON.
          // Consider using hex::encode if you know it's WKB:
          // JsonValue::String(format!("0x{}", hex::encode(bytes)))
          JsonValue::String(String::from_utf8_lossy(bytes).into_owned())
        }
        ColumnType::MYSQL_TYPE_TINY_BLOB
        | ColumnType::MYSQL_TYPE_MEDIUM_BLOB
        | ColumnType::MYSQL_TYPE_LONG_BLOB
        | ColumnType::MYSQL_TYPE_BLOB => {
          // For BLOBs, content might be binary.
          // If you expect text, from_utf8_lossy is okay (with potential '�').
          // If truly binary, Base64 encoding is a common JSON-friendly approach.
          // e.g., json!(base64::encode(bytes)) if using the `base64` crate.
          // For this generic function, we'll use from_utf8_lossy.
          JsonValue::String(String::from_utf8_lossy(bytes).into_owned())
        }
        // These are typically text-based string types
        ColumnType::MYSQL_TYPE_VARCHAR
        | ColumnType::MYSQL_TYPE_VAR_STRING
        | ColumnType::MYSQL_TYPE_STRING => {
          JsonValue::String(String::from_utf8_lossy(bytes).into_owned())
        }
        // Fallback for other ColumnTypes that might be represented as Bytes
        // (e.g. MYSQL_TYPE_VECTOR, MYSQL_TYPE_TYPED_ARRAY, MYSQL_TYPE_UNKNOWN if not handled by driver)
        _ => JsonValue::String(String::from_utf8_lossy(bytes).into_owned()),
      }
    }

    MysqlValue::Int(i) => {
      // Handles TINY, SHORT, LONG, LONGLONG, INT24
      match col_type {
        ColumnType::MYSQL_TYPE_YEAR => {
          // YEAR can be represented as a number (e.g., 2023) or string ("2023")
          json!(i) // As number
          // Or: JsonValue::String(i.to_string()) // As string
        }
        _ => json!(i),
      }
    }
    MysqlValue::UInt(u) => json!(u), // For unsigned integer types

    MysqlValue::Float(f) => Number::from_f64(*f as f64).map_or(JsonValue::Null, JsonValue::Number),
    MysqlValue::Double(d) => Number::from_f64(*d).map_or(JsonValue::Null, JsonValue::Number),

    MysqlValue::Date(year, month, day, hour, minute, second, micro_seconds) => {
      // Handles DATE, DATETIME, TIMESTAMP, (NEWDATE is internal)
      // Also TIMESTAMP2, DATETIME2 which provide fractional seconds support
      match col_type {
        ColumnType::MYSQL_TYPE_DATE | ColumnType::MYSQL_TYPE_NEWDATE => {
          JsonValue::String(format!("{:04}-{:02}-{:02}", year, month, day))
        }
        ColumnType::MYSQL_TYPE_TIMESTAMP
        | ColumnType::MYSQL_TYPE_DATETIME
        | ColumnType::MYSQL_TYPE_TIMESTAMP2
        | ColumnType::MYSQL_TYPE_DATETIME2 => {
          if *micro_seconds == 0 {
            JsonValue::String(format!(
              "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
              year, month, day, hour, minute, second
            ))
          } else {
            JsonValue::String(format!(
              "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:06}",
              year, month, day, hour, minute, second, micro_seconds
            ))
          }
        }
        _ => {
          // Fallback if col_type doesn't quite match (should ideally not happen if logic is sound)
          // or if it's a date-like representation for an unexpected original type.
          JsonValue::String(format!(
            "UnknownDateType({:?}): {:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:06}",
            col_type, year, month, day, hour, minute, second, micro_seconds
          ))
        }
      }
    }
    MysqlValue::Time(is_negative, days, hours, minutes, seconds, micro_seconds) => {
      // Handles TIME, TIME2
      // MySQL TIME can be a duration.
      let sign = if *is_negative { "-" } else { "" };
      let h = (*days as i32 * 24) + *hours as i32; // Calculate total hours for durations

      if *micro_seconds == 0 {
        JsonValue::String(format!("{}{:02}:{:02}:{:02}", sign, h, minutes, seconds))
      } else {
        JsonValue::String(format!(
          "{}{:02}:{:02}:{:02}.{:06}",
          sign, h, minutes, seconds, micro_seconds
        ))
      }
    }
    // Fallback for any MysqlValue variants not explicitly handled,
    // or if new variants are added to mysql_async::Value.
    _ => JsonValue::String(format!(
      "Unhandled MysqlValue: {:?} (Original ColumnType: {:?})",
      mysql_val, col_type
    )),
  }
}

pub(crate) fn fetch_dynamic_query_to_json(
  result_set: &mut QueryResult<Text>,
) -> Result<JsonValue, Box<dyn std::error::Error>> {
  let mut json_rows: Vec<JsonValue> = Vec::new();
  while let Some(result_set) = result_set.iter() {
    for row in result_set {
      let row = row?;
      let mut json_object_map = Map::new();

      for (i, col_meta) in row.columns_ref().iter().enumerate() {
        let col_name = col_meta.name_str().to_string();
        let col_type = col_meta.column_type(); // Get the MYSQL_TYPE_*

        let val_to_convert = row.get(i).unwrap_or(MysqlValue::NULL);

        json_object_map.insert(
          col_name,
          mysql_value_to_json_value_detailed(&val_to_convert, col_type),
        );
      }
      json_rows.push(JsonValue::Object(json_object_map));
    }
  }
  Ok(JsonValue::Array(json_rows))
}
