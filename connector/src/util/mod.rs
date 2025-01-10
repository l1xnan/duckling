//! Utilities for converting row-major tabular data into Apache Arrow.
//! Used by database client implementations.

mod arrow_reader;
pub mod coerce;
pub mod decimal;
mod row_collect;
mod row_reader;
mod row_writer;
pub mod transport;

pub(crate) mod escape;

pub use arrow_reader::ArrowReader;
pub use row_collect::{collect_rows_to_arrow, next_batch_from_rows, CellReader, RowsReader};
pub use row_reader::ArrayCellRef;
pub use row_writer::ArrowRowWriter;
