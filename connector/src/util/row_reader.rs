use arrow::array::{ArrayRef, AsArray, RecordBatch};
use arrow::datatypes::*;
use itertools::zip_eq;

use crate::types::{ArrowType, FixedSizeBinaryType};
use crate::ConnectorError;

use super::transport::{Produce, ProduceTy};

#[derive(Debug)]
pub struct ArrayCellRef<'a> {
    pub array: &'a ArrayRef,
    pub field: &'a Field,
    pub row_number: usize,
}

impl<'a> ArrayCellRef<'a> {
    pub fn vec_from_batch(batch: &'a RecordBatch, row_number: usize) -> Vec<Self> {
        zip_eq(batch.columns(), batch.schema_ref().fields())
            .map(|(array, field)| ArrayCellRef {
                array,
                field,
                row_number,
            })
            .collect()
    }
}

impl<'r> Produce<'r> for &ArrayCellRef<'r> {}

impl<'r> ProduceTy<'r, BooleanType> for &ArrayCellRef<'r> {
    fn produce(self) -> Result<<BooleanType as ArrowType>::Native, ConnectorError> {
        let array = self.array.as_boolean();
        Ok(array.value(self.row_number))
    }

    fn produce_opt(self) -> Result<Option<<BooleanType as ArrowType>::Native>, ConnectorError> {
        Ok(if self.array.is_null(self.row_number) {
            None
        } else {
            let array = self.array.as_boolean();
            Some(array.value(self.row_number))
        })
    }
}

macro_rules! impl_produce_ty {
    ($($t: ty,)+) => {
        $(
            impl<'r> ProduceTy<'r, $t> for &ArrayCellRef<'r> {
                fn produce(self) -> Result<<$t as ArrowType>::Native, ConnectorError> {
                    let array = self.array.as_primitive::<$t>();
                    Ok(array.value(self.row_number))
                }

                fn produce_opt(self) -> Result<Option<<$t as ArrowType>::Native>, ConnectorError> {
                    Ok(if self.array.is_null(self.row_number) {
                        None
                    } else {
                        let array = self.array.as_primitive::<$t>();
                        Some(array.value(self.row_number))
                    })
                }
            }
        )+
    };
}

impl_produce_ty!(
    Int8Type,
    Int16Type,
    Int32Type,
    Int64Type,
    UInt8Type,
    UInt16Type,
    UInt32Type,
    UInt64Type,
    Float16Type,
    Float32Type,
    Float64Type,
    TimestampSecondType,
    TimestampMillisecondType,
    TimestampMicrosecondType,
    TimestampNanosecondType,
    Date32Type,
    Date64Type,
    Time32SecondType,
    Time32MillisecondType,
    Time64MicrosecondType,
    Time64NanosecondType,
    IntervalYearMonthType,
    IntervalDayTimeType,
    IntervalMonthDayNanoType,
    DurationSecondType,
    DurationMillisecondType,
    DurationMicrosecondType,
    DurationNanosecondType,
    Decimal128Type,
    Decimal256Type,
);

// TODO: implement ProduceTy for byte array types without cloning

impl<'r> ProduceTy<'r, BinaryType> for &ArrayCellRef<'r> {
    fn produce(self) -> Result<Vec<u8>, ConnectorError> {
        let array = self.array.as_bytes::<BinaryType>();
        Ok(array.value(self.row_number).to_vec())
    }
    fn produce_opt(self) -> Result<Option<<BinaryType as ArrowType>::Native>, ConnectorError> {
        Ok(if self.array.is_null(self.row_number) {
            None
        } else {
            Some(ProduceTy::<BinaryType>::produce(self)?)
        })
    }
}
impl<'r> ProduceTy<'r, LargeBinaryType> for &ArrayCellRef<'r> {
    fn produce(self) -> Result<Vec<u8>, ConnectorError> {
        let array = self.array.as_bytes::<LargeBinaryType>();
        Ok(array.value(self.row_number).to_vec())
    }
    fn produce_opt(self) -> Result<Option<<LargeBinaryType as ArrowType>::Native>, ConnectorError> {
        Ok(if self.array.is_null(self.row_number) {
            None
        } else {
            Some(ProduceTy::<LargeBinaryType>::produce(self)?)
        })
    }
}
impl<'r> ProduceTy<'r, FixedSizeBinaryType> for &ArrayCellRef<'r> {
    fn produce(self) -> Result<Vec<u8>, ConnectorError> {
        let array = self.array.as_fixed_size_binary();
        Ok(array.value(self.row_number).to_vec())
    }
    fn produce_opt(
        self,
    ) -> Result<Option<<FixedSizeBinaryType as ArrowType>::Native>, ConnectorError> {
        Ok(if self.array.is_null(self.row_number) {
            None
        } else {
            Some(ProduceTy::<FixedSizeBinaryType>::produce(self)?)
        })
    }
}
impl<'r> ProduceTy<'r, Utf8Type> for &ArrayCellRef<'r> {
    fn produce(self) -> Result<String, ConnectorError> {
        let array = self.array.as_bytes::<Utf8Type>();
        Ok(array.value(self.row_number).to_string())
    }
    fn produce_opt(self) -> Result<Option<<Utf8Type as ArrowType>::Native>, ConnectorError> {
        Ok(if self.array.is_null(self.row_number) {
            None
        } else {
            Some(ProduceTy::<Utf8Type>::produce(self)?)
        })
    }
}
impl<'r> ProduceTy<'r, LargeUtf8Type> for &ArrayCellRef<'r> {
    fn produce(self) -> Result<String, ConnectorError> {
        let array = self.array.as_bytes::<LargeUtf8Type>();
        Ok(array.value(self.row_number).to_string())
    }
    fn produce_opt(self) -> Result<Option<<LargeUtf8Type as ArrowType>::Native>, ConnectorError> {
        Ok(if self.array.is_null(self.row_number) {
            None
        } else {
            Some(ProduceTy::<LargeUtf8Type>::produce(self)?)
        })
    }
}
