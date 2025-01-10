use arrow::datatypes::SchemaRef;
use arrow::record_batch::RecordBatch;
use itertools::Itertools;

use crate::errors::ConnectorError;
use crate::util::{transport, ArrowRowWriter};

/// Get next [RecordBatch] from a row-major reader.
pub fn next_batch_from_rows<'stmt, T: RowsReader<'stmt>>(
    schema: &SchemaRef,
    rows_reader: &mut T,
    batch_size: usize,
) -> Result<Option<RecordBatch>, ConnectorError> {
    let mut writer = ArrowRowWriter::new(schema.clone(), batch_size);

    for _ in 0..batch_size {
        if let Some(mut cell_reader) = rows_reader.next_row()? {
            writer.prepare_for_batch(1)?;

            for field in &schema.fields {
                let cell_ref = cell_reader.next_cell();

                transport::transport(field, cell_ref.unwrap(), &mut writer)?;
            }
        } else {
            break;
        }
    }

    let batches = writer.finish()?;
    if batches.is_empty() {
        Ok(None)
    } else {
        Ok(Some(batches.into_iter().exactly_one().unwrap()))
    }
}

/// Convert row-major reader into [RecordBatch]es.
pub fn collect_rows_to_arrow<'stmt, T: RowsReader<'stmt>>(
    schema: SchemaRef,
    rows_reader: &mut T,
    batch_size: usize,
) -> Result<Vec<RecordBatch>, ConnectorError> {
    let mut writer = ArrowRowWriter::new(schema.clone(), batch_size);
    log::debug!("reading rows");

    while let Some(mut row_reader) = rows_reader.next_row()? {
        writer.prepare_for_batch(1)?;

        log::debug!("reading row");
        for field in &schema.fields {
            log::debug!("reading cell");
            let cell_ref = row_reader.next_cell();

            log::debug!("transporting cell: {cell_ref:?}");
            transport::transport(field, cell_ref.unwrap(), &mut writer)?;
        }
    }
    writer.finish()
}

/// Iterator over rows.
// Cannot be an actual iterator, because of lifetime requirements (I think).
pub trait RowsReader<'stmt> {
    type CellReader<'row>: CellReader<'row>
    where
        Self: 'row;

    fn next_row(&mut self) -> Result<Option<Self::CellReader<'_>>, ConnectorError>;
}

/// Iterator over cells of a row.
// Cannot be an actual iterator, because of lifetime requirements (I think).
pub trait CellReader<'row> {
    type CellRef<'cell>: transport::Produce<'cell> + std::fmt::Debug
    where
        Self: 'cell;

    /// Will panic if called too many times.
    fn next_cell(&mut self) -> Option<Self::CellRef<'_>>;
}
