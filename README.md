# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)


## Dev
```
export DUCKDB_LIB_DIR=./libduckdb
export DUCKDB_INCLUDE_DIR=./libduckdb
```
Windows:
```
$env:DUCKDB_LIB_DIR="$pwd\src-tauri\libduckdb"
$env:DUCKDB_INCLUDE_DIR=$env:DUCKDB_LIB_DIR
$env:LD_LIBRARY_PATH=$env:DUCKDB_LIB_DIR
$env:PATH+=$env:DUCKDB_LIB_DIR
```