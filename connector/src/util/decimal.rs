use arrow::datatypes::{i256, DataType};

pub fn decimal128_to_string(ty: &DataType, value: i128) -> String {
    let DataType::Decimal128(_, scale) = ty else {
        unreachable!();
    };
    insert_dot(scale, value.to_string())
}

pub fn decimal256_to_string(ty: &DataType, value: i256) -> String {
    let DataType::Decimal256(_, scale) = ty else {
        unreachable!();
    };
    insert_dot(scale, value.to_string())
}

fn insert_dot(scale: &i8, value: String) -> String {
    if *scale > 0 {
        let minus_len: usize = if value.starts_with('-') { 1 } else { 0 };

        let fracs = *scale as usize;
        if fracs >= value.len() - minus_len {
            let (minus, value) = value.split_at(minus_len);
            format!("{minus}0.{}{value}", "0".repeat(fracs - value.len()))
        } else {
            let mut value = value;
            value.insert(value.len() - fracs, '.');
            value
        }
    } else {
        value
    }
}
