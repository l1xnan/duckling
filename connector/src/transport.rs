use arrow::datatypes::*;

/// Moving of typed values from a producer into a consumer
use crate::errors::ConnectorError;
use crate::types::{ArrowType, FixedSizeBinaryType, NullType};

macro_rules! impl_transport_match {
    ($f: expr, $c: expr, $p: expr, $({ $Pat: pat => $ArrTy: ty })*) => {
        let dt = $f.data_type();
        if !$f.is_nullable() {
            match dt {
                Null => ConsumeTy::<NullType>::consume_null($c, dt),
                $(
                    $Pat => ConsumeTy::<$ArrTy>::consume($c, dt, ProduceTy::<$ArrTy>::produce($p)?),
                )*
                _ => todo!("unimplemented transport of {:?}", dt),
            }
        } else {
            match dt {
                Null => ConsumeTy::<NullType>::consume_null($c, dt),
                $(
                    $Pat => {
                        if let Some(v) = ProduceTy::<$ArrTy>::produce_opt($p)? {
                            ConsumeTy::<$ArrTy>::consume($c, dt, v)
                        } else {
                            ConsumeTy::<$ArrTy>::consume_null($c, dt)
                        }
                    },
                )*
                _ => todo!("unimplemented transport of {:?}", dt),
            }
        }
    };
}

/// Take a value of type `ty` from [Produce] and insert it into [Consume].
pub fn transport<'r, P: Produce<'r>, C: Consume>(
    field: &Field,
    producer: P,
    consumer: &mut C,
) -> Result<(), ConnectorError> {
    log::debug!("transporting value of type {field:?}");

    // TODO: connector-x goes a step further here: instead of having this match in the hot path,
    // this function returns a transporter function that is stored in a vec, for faster lookup.

    use DataType::*;
    impl_transport_match!(
        field,
        consumer,
        producer,
        { Boolean => BooleanType }
        { Int8 => Int8Type }
        { Int16 => Int16Type }
        { Int32 => Int32Type }
        { Int64 => Int64Type }
        { UInt8 => UInt8Type }
        { UInt16 => UInt16Type }
        { UInt32 => UInt32Type }
        { UInt64 => UInt64Type }
        { Float16 => Float16Type }
        { Float32 => Float32Type }
        { Float64 => Float64Type }
        { Timestamp(TimeUnit::Second, _) => TimestampSecondType }
        { Timestamp(TimeUnit::Millisecond, _) => TimestampMillisecondType }
        { Timestamp(TimeUnit::Microsecond, _) => TimestampMicrosecondType }
        { Timestamp(TimeUnit::Nanosecond, _) => TimestampNanosecondType }
        { Date32 => Date32Type }
        { Date64 => Date64Type }
        { Time32(TimeUnit::Second) => Time32SecondType }
        { Time32(TimeUnit::Millisecond) => Time32MillisecondType }
        { Time64(TimeUnit::Microsecond) => Time64MicrosecondType }
        { Time64(TimeUnit::Nanosecond) => Time64NanosecondType }
        { Interval(IntervalUnit::YearMonth) => IntervalYearMonthType }
        { Interval(IntervalUnit::DayTime) => IntervalDayTimeType }
        { Interval(IntervalUnit::MonthDayNano) => IntervalMonthDayNanoType }
        { Duration(TimeUnit::Second) => DurationSecondType }
        { Duration(TimeUnit::Millisecond) => DurationMillisecondType }
        { Duration(TimeUnit::Microsecond) => DurationMicrosecondType }
        { Duration(TimeUnit::Nanosecond) => DurationNanosecondType }
        { Binary => BinaryType }
        { LargeBinary => LargeBinaryType }
        { FixedSizeBinary(_) => FixedSizeBinaryType }
        { Utf8 => Utf8Type }
        { LargeUtf8 => LargeUtf8Type }
        { Decimal128(_, _) => Decimal128Type }
        { Decimal256(_, _) => Decimal256Type }
    );
    Ok(())
}

/// Ability to produce values of all arrow types.
pub trait Produce<'r>:
    ProduceTy<'r, BooleanType>
    + ProduceTy<'r, Int8Type>
    + ProduceTy<'r, Int16Type>
    + ProduceTy<'r, Int32Type>
    + ProduceTy<'r, Int64Type>
    + ProduceTy<'r, UInt8Type>
    + ProduceTy<'r, UInt16Type>
    + ProduceTy<'r, UInt32Type>
    + ProduceTy<'r, UInt64Type>
    + ProduceTy<'r, Float16Type>
    + ProduceTy<'r, Float32Type>
    + ProduceTy<'r, Float64Type>
    + ProduceTy<'r, TimestampSecondType>
    + ProduceTy<'r, TimestampMillisecondType>
    + ProduceTy<'r, TimestampMicrosecondType>
    + ProduceTy<'r, TimestampNanosecondType>
    + ProduceTy<'r, Date32Type>
    + ProduceTy<'r, Date64Type>
    + ProduceTy<'r, Time32SecondType>
    + ProduceTy<'r, Time32MillisecondType>
    + ProduceTy<'r, Time64MicrosecondType>
    + ProduceTy<'r, Time64NanosecondType>
    + ProduceTy<'r, IntervalYearMonthType>
    + ProduceTy<'r, IntervalDayTimeType>
    + ProduceTy<'r, IntervalMonthDayNanoType>
    + ProduceTy<'r, DurationSecondType>
    + ProduceTy<'r, DurationMillisecondType>
    + ProduceTy<'r, DurationMicrosecondType>
    + ProduceTy<'r, DurationNanosecondType>
    + ProduceTy<'r, BinaryType>
    + ProduceTy<'r, LargeBinaryType>
    + ProduceTy<'r, FixedSizeBinaryType>
    + ProduceTy<'r, Utf8Type>
    + ProduceTy<'r, LargeUtf8Type>
    + ProduceTy<'r, Decimal128Type>
    + ProduceTy<'r, Decimal256Type>
{
}

/// Ability to produce a value of an arrow type
pub trait ProduceTy<'r, T: ArrowType> {
    fn produce(self) -> Result<T::Native, ConnectorError>;

    fn produce_opt(self) -> Result<Option<T::Native>, ConnectorError>;
}

/// Ability to consume values of all arrow types.
pub trait Consume:
    ConsumeTy<NullType>
    + ConsumeTy<BooleanType>
    + ConsumeTy<Int8Type>
    + ConsumeTy<Int16Type>
    + ConsumeTy<Int32Type>
    + ConsumeTy<Int64Type>
    + ConsumeTy<UInt8Type>
    + ConsumeTy<UInt16Type>
    + ConsumeTy<UInt32Type>
    + ConsumeTy<UInt64Type>
    + ConsumeTy<Float16Type>
    + ConsumeTy<Float32Type>
    + ConsumeTy<Float64Type>
    + ConsumeTy<TimestampSecondType>
    + ConsumeTy<TimestampMillisecondType>
    + ConsumeTy<TimestampMicrosecondType>
    + ConsumeTy<TimestampNanosecondType>
    + ConsumeTy<Date32Type>
    + ConsumeTy<Date64Type>
    + ConsumeTy<Time32SecondType>
    + ConsumeTy<Time32MillisecondType>
    + ConsumeTy<Time64MicrosecondType>
    + ConsumeTy<Time64NanosecondType>
    + ConsumeTy<IntervalYearMonthType>
    + ConsumeTy<IntervalDayTimeType>
    + ConsumeTy<IntervalMonthDayNanoType>
    + ConsumeTy<DurationSecondType>
    + ConsumeTy<DurationMillisecondType>
    + ConsumeTy<DurationMicrosecondType>
    + ConsumeTy<DurationNanosecondType>
    + ConsumeTy<BinaryType>
    + ConsumeTy<LargeBinaryType>
    + ConsumeTy<FixedSizeBinaryType>
    + ConsumeTy<Utf8Type>
    + ConsumeTy<LargeUtf8Type>
    + ConsumeTy<Decimal128Type>
    + ConsumeTy<Decimal256Type>
{
}

/// Ability to consume a value of an an arrow type
pub trait ConsumeTy<T: ArrowType> {
    fn consume(&mut self, ty: &DataType, value: T::Native);

    fn consume_null(&mut self, ty: &DataType);
}

pub mod print {
    use super::{ArrowType, Consume, ConsumeTy, DataType};

    pub struct PrintConsumer();

    impl Consume for PrintConsumer {}

    impl<T: ArrowType> ConsumeTy<T> for PrintConsumer
    where
        T::Native: std::fmt::Debug,
    {
        fn consume(&mut self, _ty: &DataType, value: T::Native) {
            println!("{}: {value:?}", std::any::type_name::<T>());
        }

        fn consume_null(&mut self, _ty: &DataType) {
            println!("{}: null", std::any::type_name::<T>());
        }
    }
}

#[macro_export]
macro_rules! impl_produce_unsupported {
    ($p: ty, ($($t: ty,)+)) => {
        $(
            impl<'r> $crate::util::transport::ProduceTy<'r, $t> for $p {
                fn produce(self) -> Result<<$t as $crate::types::ArrowType>::Native, ConnectorError> {
                   unimplemented!("unsupported");
                }
                fn produce_opt(self) -> Result<Option<<$t as $crate::types::ArrowType>::Native>, ConnectorError> {
                   unimplemented!("unsupported");
                }
            }
        )+
    };
}

#[macro_export]
macro_rules! impl_consume_unsupported {
    ($c: ty, ($($t: ty,)+)) => {
        $(
            impl $crate::util::transport::ConsumeTy<$t> for $c {
                fn consume(&mut self, _ty: &arrow::datatypes::DataType, _val: <$t as $crate::types::ArrowType>::Native) {
                    unimplemented!("unsupported");
                }
                fn consume_null(&mut self, _ty: &DataType) {
                    unimplemented!("unsupported");
                }
            }
        )+
    };
}
