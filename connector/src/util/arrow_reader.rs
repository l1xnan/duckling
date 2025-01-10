use std::sync::Arc;

use arrow::datatypes::SchemaRef;
use arrow::record_batch::RecordBatch;

use crate::api::ResultReader;
use crate::errors::ConnectorError;

/// Reader that already contains all of the batches preloaded and just returns them one by one.
///
/// Useful for date store implementations that don't support streaming.
pub struct ArrowReader {
    schema: SchemaRef,
    inner: std::vec::IntoIter<RecordBatch>,
}

impl ArrowReader {
    pub fn new(schema: SchemaRef, batches: Vec<RecordBatch>) -> Self {
        ArrowReader {
            schema,
            inner: batches.into_iter(),
        }
    }
}

impl Iterator for ArrowReader {
    type Item = Result<RecordBatch, ConnectorError>;

    fn next(&mut self) -> Option<Self::Item> {
        self.inner.next().map(Ok)
    }
}

impl<'stmt> ResultReader<'stmt> for ArrowReader {
    fn get_schema(&mut self) -> Result<Arc<arrow::datatypes::Schema>, ConnectorError> {
        Ok(self.schema.clone())
    }
}
