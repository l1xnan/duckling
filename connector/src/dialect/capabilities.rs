use serde::Serialize;

/// Feature flags describing what a dialect connection supports.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Caps(u32);

impl Caps {
  pub const QUERY: Caps = Caps(1 << 0);
  pub const METADATA: Caps = Caps(1 << 1);
  pub const PAGING: Caps = Caps(1 << 2);
  pub const EXPORT: Caps = Caps(1 << 3);
  pub const FIND: Caps = Caps(1 << 4);
  pub const DROP_TABLE: Caps = Caps(1 << 5);
  pub const EXECUTE: Caps = Caps(1 << 6);
  pub const TABLE_BROWSE: Caps = Caps(1 << 7);

  /// Common SQL dialect set: query + metadata + paging + export + table browse.
  pub const SQL_CORE: Caps = Caps(
    Self::QUERY.0
      | Self::METADATA.0
      | Self::PAGING.0
      | Self::EXPORT.0
      | Self::TABLE_BROWSE.0,
  );

  pub const fn empty() -> Self {
    Caps(0)
  }

  pub const fn bits(self) -> u32 {
    self.0
  }

  pub const fn contains(self, other: Caps) -> bool {
    (self.0 & other.0) == other.0
  }

  pub const fn union(self, other: Caps) -> Self {
    Caps(self.0 | other.0)
  }

  pub const fn intersection(self, other: Caps) -> Self {
    Caps(self.0 & other.0)
  }

  /// Stable string names for IPC / frontend.
  pub fn names(self) -> Vec<&'static str> {
    let mut out = Vec::new();
    if self.contains(Self::QUERY) {
      out.push("query");
    }
    if self.contains(Self::METADATA) {
      out.push("metadata");
    }
    if self.contains(Self::PAGING) {
      out.push("paging");
    }
    if self.contains(Self::EXPORT) {
      out.push("export");
    }
    if self.contains(Self::FIND) {
      out.push("find");
    }
    if self.contains(Self::DROP_TABLE) {
      out.push("drop_table");
    }
    if self.contains(Self::EXECUTE) {
      out.push("execute");
    }
    if self.contains(Self::TABLE_BROWSE) {
      out.push("table_browse");
    }
    out
  }

  pub fn from_names(names: &[&str]) -> Self {
    let mut caps = Caps::empty();
    for name in names {
      caps = caps.union(match *name {
        "query" => Self::QUERY,
        "metadata" => Self::METADATA,
        "paging" => Self::PAGING,
        "export" => Self::EXPORT,
        "find" => Self::FIND,
        "drop_table" => Self::DROP_TABLE,
        "execute" => Self::EXECUTE,
        "table_browse" => Self::TABLE_BROWSE,
        _ => Caps::empty(),
      });
    }
    caps
  }
}

impl std::ops::BitOr for Caps {
  type Output = Self;
  fn bitor(self, rhs: Self) -> Self {
    self.union(rhs)
  }
}

impl Serialize for Caps {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: serde::Serializer,
  {
    self.names().serialize(serializer)
  }
}

/// Per-dialect capability table used by factories and tests.
pub fn caps_for_dialect(dialect: &str) -> Caps {
  match dialect {
    "mysql" | "postgres" | "clickhouse" | "quack" => Caps::SQL_CORE,
    "duckdb" => Caps::SQL_CORE | Caps::DROP_TABLE,
    "sqlite" => Caps::QUERY | Caps::METADATA | Caps::PAGING | Caps::EXPORT | Caps::TABLE_BROWSE,
    "folder" => {
      Caps::QUERY
        | Caps::METADATA
        | Caps::PAGING
        | Caps::EXPORT
        | Caps::FIND
        | Caps::DROP_TABLE
        | Caps::TABLE_BROWSE
    }
    "file" => Caps::QUERY | Caps::PAGING | Caps::TABLE_BROWSE,
    _ => Caps::QUERY,
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn names_roundtrip() {
    let caps = Caps::SQL_CORE | Caps::DROP_TABLE | Caps::FIND;
    let names = caps.names();
    assert!(names.contains(&"query"));
    assert!(names.contains(&"drop_table"));
    assert!(names.contains(&"find"));
    let back = Caps::from_names(&names);
    assert_eq!(back.bits(), caps.bits());
  }

  #[test]
  fn contains_and_union() {
    let a = Caps::QUERY | Caps::EXPORT;
    assert!(a.contains(Caps::QUERY));
    assert!(a.contains(Caps::EXPORT));
    assert!(!a.contains(Caps::FIND));
    assert!(a.union(Caps::FIND).contains(Caps::FIND));
  }

  #[test]
  fn dialect_table_matches_product_expectations() {
    assert!(caps_for_dialect("mysql").contains(Caps::SQL_CORE));
    assert!(caps_for_dialect("postgres").contains(Caps::EXPORT));
    assert!(caps_for_dialect("duckdb").contains(Caps::DROP_TABLE));
    assert!(caps_for_dialect("folder").contains(Caps::FIND));
    assert!(!caps_for_dialect("file").contains(Caps::FIND));
    assert!(!caps_for_dialect("sqlite").contains(Caps::DROP_TABLE));
    assert!(!caps_for_dialect("mysql").contains(Caps::FIND));
  }

  #[test]
  fn serialize_as_string_list() {
    let caps = Caps::QUERY | Caps::PAGING;
    let json = serde_json::to_string(&caps).unwrap();
    assert!(json.contains("query"));
    assert!(json.contains("paging"));
  }
}
