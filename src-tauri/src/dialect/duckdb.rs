use crate::dialect::Dialect;

/// A [`Dialect`] for [DuckDB](https://duckdb.org/)
#[derive(Debug, Default)]
pub struct DuckDbDialect;

// In most cases the redshift dialect is identical to [`PostgresSqlDialect`].
impl Dialect for DuckDbDialect {
    
}
