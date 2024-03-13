⚠️正在开发中，目前不稳定⚠️

# Duckling

[English](./README.md) | 中文

Duckling 是使用 Tauri 构建的轻量级桌面应用，用于快速浏览 `parquet`/`csv`文件数据和各种数据库数据，
支持 [DuckDB](https://github.com/duckdb/duckdb)/SQLite，同时对于如下数据库提供实验性支持（没有大量测试）：

- PostgreSQL
- MySQL
- Clickhouse（注意仅支持 [Native Protocol port](https://clickhouse.com/docs/en/guides/sre/network-ports)，一般是 `9000`）
- Doris/StarRocks（通过 MySQL 协议支持，端口默认为 `9030`）

注意：本项目当前的目标不是构建一个全功能的数据库管理工具，只是为了方便的快速浏览各种类型的数据。

## 安装

从 [releases](https://github.com/l1xnan/Duckling/releases) 页面下载最新的安装包，进行安装。

对于 Windows 平台，依赖 Webview2，如果遇到网络问题无法安装，可以[离线下载](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section) 安装 Webview2。

## 使用

打开数据文件夹、`*.duckdb` 文件或者数据库连接。

![screenshot-dark](./assets/screenshot-dark.png)

![screenshot](./assets/screenshot.png)

## 开发

如果 `bundled` 构建失败，可以在 [duckdb releases](https://github.com/duckdb/duckdb/releases) 页面下载对应平台和版本的 libduckdb
文件(例如：`libduckdb-windows-amd64.zip`)，解压到到 `./src-tauri` 文件夹。
