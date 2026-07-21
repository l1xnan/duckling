//! Unified preview IR: dialects decode into [`PreviewGrid`], then shared code
//! builds Arrow (`grid_to_arrow`) or rows payloads (`grid_to_preview_rows`).

mod build;
mod cell;
mod grid;

pub use build::{grid_to_arrow, grid_to_raw_arrow_data};
pub use cell::{DecodeResult, LogicalKind, PreviewCell};
pub use grid::{PreviewColumn, PreviewGrid};
