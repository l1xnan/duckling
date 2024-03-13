⚠️ Actively in Development and currently unstable ⚠️

# Duckling

English | [中文](./README.zh.md)

Duckling is a lightweight desktop application built using Tauri, designed for quickly browsing `parquet`/`csv` file data and various databases.
It supports [DuckDB](https://github.com/duckdb/duckdb)/SQLite, and Experimental support is provided for the following databases(Not a lot of testing):

- PostgreSQL
- MySQL
- Clickhouse (please note that only [Native Protocol port](https://clickhouse.com/docs/en/guides/sre/network-ports) is supported, usually `9000`)
- Doris/StarRocks(MySQL protocol, usually use `9030` port)

Note: The current objective of this project is not to develop a fully functional database management tool, but rather to facilitate quick browsing of various types of data.

## Installation

From [releases](https://github.com/l1xnan/Duckling/releases) page to download the latest installation package, for
installation.

For Windows platform, you can download
and [install Webview2 offline]((https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section)) if you
cannot install Webview2 due to network problems.

## Usage

Open the data folder or `*.duckdb` file.

![screenshot-dark](./assets/screenshot-dark.png)

![screenshot](./assets/screenshot.png)

## Development

If `bundled` fails to build, download the libduckdb releases file for platform and version
in the [duckdb releases](https://github.com/duckdb/duckdb/releases) page(e.g. libduckdb-windows-amd64.zip), unzip to `./src-tauri` folder.
