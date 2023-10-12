fn main() {
  // for non bundled build duckdb
  let dir = "./libduckdb";
  println!("cargo:rustc-link-search={dir}");
  tauri_build::build()
}
