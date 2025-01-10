use std::any::Any;

use arrow::array::{ArrayBuilder, ArrayRef, FixedSizeBinaryBuilder};
use arrow::datatypes::*;
use arrow::record_batch::RecordBatch;

use crate::errors::ConnectorError;
use crate::types::{ArrowType, FixedSizeBinaryType, NullType};
use crate::util::transport::{Consume, ConsumeTy};

/// Receives values row-by-row and passes them to [ArrayBuilder]s,
/// which construct [RecordBatch]es.
pub struct ArrowRowWriter {
    schema: SchemaRef,
    min_batch_size: usize,
    data: Vec<RecordBatch>,

    /// Determines into which column the next stream value should go.
    receiver: Organizer,

    /// Array buffers.
    builders: Option<Vec<Box<dyn ArrayBuilder>>>,
    /// Number of rows reserved to be written in by [ArrowPartitionWriter::prepare_for_batch]
    rows_reserved: usize,
    /// Number of rows allocated within builders.
    rows_capacity: usize,
}

impl ArrowRowWriter {
    pub fn new(schema: SchemaRef, min_batch_size: usize) -> Self {
        ArrowRowWriter {
            receiver: Organizer::new(schema.fields().len()),
            data: Vec::new(),

            builders: None,
            rows_reserved: 0,
            rows_capacity: 0,

            schema,
            min_batch_size,
        }
    }

    pub fn prepare_for_batch(&mut self, row_count: usize) -> Result<(), ConnectorError> {
        self.receiver.reset_for_batch(row_count);
        self.allocate(row_count)?;
        Ok(())
    }

    /// Make sure that there is enough memory allocated in builders for the incoming batch.
    /// Might allocate more than needed, for future row reservations.
    fn allocate(&mut self, row_count: usize) -> Result<(), ConnectorError> {
        if self.rows_capacity >= row_count + self.rows_reserved {
            // there is enough capacity, no need to allocate
            self.rows_reserved += row_count;
            return Ok(());
        }

        if self.rows_reserved > 0 {
            self.flush()?;
        }

        let to_allocate = usize::max(row_count, self.min_batch_size);

        let builders: Vec<Box<dyn ArrayBuilder>> = self
            .schema
            .fields
            .iter()
            .map(|f| arrow::array::make_builder(f.data_type(), to_allocate))
            .collect();

        self.builders = Some(builders);
        self.rows_reserved = row_count;
        self.rows_capacity = to_allocate;
        Ok(())
    }

    fn flush(&mut self) -> Result<(), ConnectorError> {
        let Some(mut builders) = self.builders.take() else {
            return Ok(());
        };
        let columns: Vec<ArrayRef> = builders
            .iter_mut()
            .map(|builder| builder.finish().slice(0, self.rows_reserved))
            .collect();
        let rb = RecordBatch::try_new(self.schema.clone(), columns)?;
        self.data.push(rb);
        Ok(())
    }

    pub fn finish(mut self) -> Result<Vec<RecordBatch>, ConnectorError> {
        self.flush()?;
        Ok(self.data)
    }

    fn next_builder(&mut self) -> &mut dyn Any {
        let col = self.receiver.next_col_index();
        // this is safe, because prepare_for_batch must have been called earlier
        let builders = self.builders.as_mut().unwrap();
        builders[col].as_any_mut()
    }
}

impl Consume for ArrowRowWriter {}

/// Determines into which column the next stream value should go.
pub struct Organizer {
    col_count: usize,
    row_count: usize,

    next_row: usize,
    next_col: usize,
}

impl Organizer {
    fn new(col_count: usize) -> Self {
        Organizer {
            col_count,
            row_count: 0,

            next_row: 0,
            next_col: 0,
        }
    }

    fn reset_for_batch(&mut self, row_count: usize) {
        self.row_count = row_count;
        self.next_row = 0;
        self.next_col = 0;
    }

    fn next_col_index(&mut self) -> usize {
        let col = self.next_col;

        self.next_col += 1;
        if self.next_col == self.col_count {
            self.next_col = 0;
            self.next_row += 1;
        }
        col
    }
}

macro_rules! impl_consume_ty {
    ($({ $ArrTy:ty => $Builder:tt } )*) => {
        $(
            impl ConsumeTy<$ArrTy> for ArrowRowWriter {
                fn consume(&mut self, _ty: &DataType, value: <$ArrTy as ArrowType>::Native) {
                    self.next_builder()
                        .downcast_mut::<arrow::array::builder::$Builder>()
                        .expect(concat!("bad cast to ", stringify!($Builder)))
                        .append_value(value);
                }

                fn consume_null(&mut self, _ty: &DataType) {
                    self.next_builder()
                        .downcast_mut::<arrow::array::builder::$Builder>()
                        .expect(concat!("bad cast to ", stringify!($Builder)))
                        .append_null();
                }
            }
        )+
    };
}

// List of ConsumeTy implementations to generate.
// Must match with arrow::array::make_builder
impl_consume_ty! {
//  { Null                => NullBuilder            } custom implementation
    { BooleanType         => BooleanBuilder         }
    { Int8Type            => Int8Builder            }
    { Int16Type           => Int16Builder           }
    { Int32Type           => Int32Builder           }
    { Int64Type           => Int64Builder           }
    { UInt8Type           => UInt8Builder           }
    { UInt16Type          => UInt16Builder          }
    { UInt32Type          => UInt32Builder          }
    { UInt64Type          => UInt64Builder          }
    { Float16Type         => Float16Builder         }
    { Float32Type         => Float32Builder         }
    { Float64Type         => Float64Builder         }

    { TimestampSecondType       =>  TimestampSecondBuilder      }
    { TimestampMillisecondType  =>  TimestampMillisecondBuilder }
    { TimestampMicrosecondType  =>  TimestampMicrosecondBuilder }
    { TimestampNanosecondType   =>  TimestampNanosecondBuilder  }
    { Date32Type                =>  Date32Builder               }
    { Date64Type                =>  Date64Builder               }
    { Time32SecondType          =>  Time32SecondBuilder         }
    { Time32MillisecondType     =>  Time32MillisecondBuilder    }
    { Time64MicrosecondType     =>  Time64MicrosecondBuilder    }
    { Time64NanosecondType      =>  Time64NanosecondBuilder     }
    { IntervalYearMonthType     =>  IntervalYearMonthBuilder    }
    { IntervalDayTimeType       =>  IntervalDayTimeBuilder      }
    { IntervalMonthDayNanoType  =>  IntervalMonthDayNanoBuilder }
    { DurationSecondType        =>  DurationSecondBuilder       }
    { DurationMillisecondType   =>  DurationMillisecondBuilder  }
    { DurationMicrosecondType   =>  DurationMicrosecondBuilder  }
    { DurationNanosecondType    =>  DurationNanosecondBuilder   }

    { Decimal128Type      => Decimal128Builder      }
    { Decimal256Type      => Decimal256Builder      }

}

impl ConsumeTy<NullType> for ArrowRowWriter {
    fn consume(&mut self, ty: &DataType, _: ()) {
        ConsumeTy::<NullType>::consume_null(self, ty)
    }

    fn consume_null(&mut self, _ty: &DataType) {
        self.next_builder()
            .downcast_mut::<arrow::array::builder::NullBuilder>()
            .expect(concat!("bad cast to ", stringify!(NullBuilder)))
            .append_null();
    }
}

macro_rules! impl_consume_ref_ty {
    ($({ $ArrTy:ty => $Builder:tt })*) => {
        $(
            impl ConsumeTy<$ArrTy> for ArrowRowWriter {
                fn consume(&mut self, _ty: &DataType, value: <$ArrTy as ArrowType>::Native) {
                    self.next_builder()
                        .downcast_mut::<arrow::array::builder::$Builder>()
                        .expect(concat!("bad cast to ", stringify!($Builder)))
                        .append_value(&value);
                }

                fn consume_null(&mut self, _ty: &DataType) {
                    self.next_builder()
                        .downcast_mut::<arrow::array::builder::$Builder>()
                        .expect(concat!("bad cast to ", stringify!($Builder)))
                        .append_null();
                }
            }
        )+
    };
}
impl_consume_ref_ty! {
    { BinaryType          => BinaryBuilder          }
    { LargeBinaryType     => LargeBinaryBuilder     }
//  { FixedSizeBinaryType => FixedSizeBinaryBuilder } custom impl
    { Utf8Type            => StringBuilder          }
    { LargeUtf8Type       => LargeStringBuilder     }
}

impl ConsumeTy<FixedSizeBinaryType> for ArrowRowWriter {
    fn consume(&mut self, _ty: &DataType, value: <FixedSizeBinaryType as ArrowType>::Native) {
        self.next_builder()
            .downcast_mut::<arrow::array::builder::FixedSizeBinaryBuilder>()
            .expect(concat!("bad cast to ", stringify!(FixedSizeBinaryBuilder)))
            .append_value(&value)
            .unwrap();
    }

    fn consume_null(&mut self, _ty: &DataType) {
        self.next_builder()
            .downcast_mut::<FixedSizeBinaryBuilder>()
            .expect(concat!("bad cast to ", stringify!($Builder)))
            .append_null();
    }
}
