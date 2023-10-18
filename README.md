# DuckStudio

[中文](./README.zh.md)

DuckStudio is a lightweight desktop applications, the use of Tauri build for fast browsing `parquet` / `CSV` file data and database data for [DuckDB](https://github.com/duckdb/duckdb).

## Installation

From [releases](https://github.com/l1xnan/DuckStudio/releases) page to download the latest installation package, for installation.

For Windows platform, you can download and [install Webview2 offline]((https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section)) if you cannot install Webview2 due to network problems.

## Usage

Open the data folder or `*.duckdb` file.

![screenshot](./assets/screenshot.png)

## Development

If `bundled` fails to build, download the libduckdb releases file for platform and version in the duckdb releases page(e.g. [libduckdb-windows-amd64.zip](https://github.com/duckdb/duckdb/releases/download/v0.9.1/libduckdb-windows-amd64.zip)), unzip to `./src-tauri` folder.
