⚠️正在开发中，目前不稳定⚠️

# Duckling

[English](./README.md) | 中文

Duckling 是使用 [Tauri](https://v2.tauri.app/) 构建的轻量级桌面应用，用于快速浏览 `parquet`/`csv`/`json` 文件数据和各种数据库数据。除浏览外，还内置了 SQL 编辑器、透视表、列画像、单元格查看与数据导出等分析工具，让你无需离开应用即可探索和分析数据。

原生支持 [DuckDB](https://github.com/duckdb/duckdb)/SQLite，同时对于以下数据库提供实验性支持（没有大量测试）：

- PostgreSQL
- MySQL
- ClickHouse（HTTP 接口，端口一般为 `8123`）
- Doris / StarRocks（通过 MySQL 协议，端口一般为 `9030`）

注意：本项目当前的目标不是构建一个全功能的数据库管理工具，只是为了方便快速浏览和轻量分析各种类型的数据。

## 功能特性

- **数据浏览** — 基于 Canvas 渲染的结果网格，支持分页、隐藏列、转置、结果过滤与单元格值查看。
- **SQL 编辑器** — 基于 Monaco，具备表/列感知的自动补全，以及运行 / 格式化 / `EXPLAIN` 与 SQL 书签功能。
- **SQL 模板变量** — 在 SQL 中写入 Jinja2 风格 `{{ variable }}` 占位符，通过 `/* @vars */` YAML 块注释声明值，一次运行多值查询（笛卡尔积 → 多个结果标签页）。详见 [SQL 模板](#sql-模板)。
- **透视表** — 通过行维 / 列维与度量（`count` / `sum` / `avg` / `min` / `max`）构建透视，提供高基数警告与复制 SQL 能力。
- **列画像** — 每列的统计数据：总数、空值比例、去重数、最大/最小值以及高频取值。
- **按列统计** — 单列的值分布，以表格加柱状图呈现。
- **值查看器** — 以原始 / JSON 形式查看单元格，并提供「计算」标签页对选中单元格做统计（最小/最大/均值……）并导出为 Markdown。
- **数据导出** — 将当前结果导出为 CSV / TSV / JSON / Parquet / XLSX，支持分隔符、表头与压缩选项。
- **侧边栏** — 数据库资源管理器、查询历史与收藏（置顶表 + 已保存 SQL），均支持搜索。
- **设置套件** — 外观与语言、SSH 配置、快捷键、SQL 格式化、导入导出选项以及应用内更新。
- **键盘快捷键** — 分类快捷键浮层（`Mod+/`）与可重映射的快捷键设置页。

## 支持的数据源

已实现的连接器：

- **DuckDB** — 打开 `*.duckdb` 文件（可附加工作路径）。
- **DuckDB（Quack）** — 通过 URI + token 连接（内存 / 远程 Quack）。
- **数据文件夹** — 选择一个目录以浏览 `parquet` / `csv` 等文件。
- **SQLite** — 打开数据库文件。
- **MySQL** — 主机 / 端口 / 数据库 / 用户名 / 密码。
- **PostgreSQL** — 主机 / 端口 / 数据库 / 用户名 / 密码 + SSL 模式。
- **ClickHouse** — 主机 / 端口 / 数据库 / 用户名 / 密码（HTTP 接口）。

实验性（未充分测试）：

- **Doris / StarRocks** — 通过 MySQL 协议，端口默认为 `9030`。

其他入口：

- **文件关联** — 直接打开 `.duckdb` 或 `.parquet` 文件即可启动 Duckling。
- **SSH 隧道** — 适用于 MySQL / PostgreSQL，可使用可复用的 SSH 配置或手动配置。
- **连接传输** — 将一个或所有连接导出 / 导入为 JSON，可选择用主密码加密密钥。

## 安装

从 [releases](https://github.com/l1xnan/Duckling/releases) 页面下载对应平台的最新安装包进行安装。

对于 Windows 平台，如果因网络问题无法安装 WebView2，可以[离线下载安装 WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section)。

**注意**：软件安装路径要选择空白文件夹或者新建文件夹，不要选择非空文件夹，也不要将数据文件放到安装路径中，否则卸载时，如果选择了清空数据文件，整个文件夹会被删除，即使不是软件自己的文件。

## 使用

打开数据文件夹、`*.duckdb` 文件或者数据库连接。

![screenshot-dark](./assets/screenshot-dark.png)

![screenshot](./assets/screenshot.png)

## SQL 模板

一次编写模板，针对不同的表或值多次运行，无需重复复制 SQL。

### 快速开始

```sql
/*
@vars
schema: public
table:
  - orders
  - order_items
  - payments
*/

SELECT COUNT(*) FROM {{ schema }}.{{ table }}
```

1. **直接运行**（`Mod+Enter` / 工具栏 ▶）—— 后端读取 `@vars`，找到 `{{ schema }}` 和 `{{ table }}`，对每种组合展开 SQL，每个组合生成一个结果标签页。
2. **缺变量** —— 如果某个占位符尚无值，会弹出对话框填写（每行一个值）。勾选「将变量以 @vars 注释写入 SQL 上方」会把填写的值写回 SQL 顶部的 `@vars` 块，下次运行无需弹窗。
3. **工具栏 `{}` 按钮** —— 选中 SQL，点击工具栏中的 `{}` 按钮，自动为选中内容中的所有 `{{ name }}` 占位符生成 `@vars` 骨架。直接在编辑器里填写值即可。

### 示例

**单变量 — 跨表批量**

```sql
/*
@vars
table:
  - customers
  - orders
  - products
*/

SELECT COUNT(*) AS cnt FROM {{ table }}
```

→ 3 个结果标签页，分别统计 `customers`、`orders`、`products` 的行数。

**多变量 — 笛卡尔积**

```sql
/*
@vars
schema: public
region:
  - us
  - eu
*/

SELECT region, COUNT(*) AS cnt
FROM {{ schema }}.{{ table_prefix }}_{{ region }}
GROUP BY region
```

`table_prefix` 在对话框中填为 `sales`，展开为 2 条 SQL（`public.sales_us`、`public.sales_eu`），各生成一个结果标签页。

**WHERE 条件中的日期范围**

```sql
/*
@vars
table: events
start_date: '2024-01-01'
end_date: '2024-12-31'
*/

SELECT date, COUNT(*)
FROM {{ table }}
WHERE dt BETWEEN {{ start_date }} AND {{ end_date }}
GROUP BY date
```

**聚合查询中的列名**

```sql
/*
@vars
measure: revenue
segment: country
*/

SELECT {{ segment }}, SUM({{ measure }}) AS total
FROM sales
GROUP BY {{ segment }}
ORDER BY total DESC
```

### 语法

| 结构 | 含义 |
|------|------|
| `{{ name }}` | 变量占位符（Jinja2 插值语法）。名称必须为简单标识符。 |
| `/* @vars` … `*/` | 前导块注释，声明 YAML 格式的变量值。支持标量（单值）和序列（多值）。 |
| 单值 | `table: orders` |
| 多值 | `table:` 后跟 `  - orders` / `  - items`（每行一个，YAML 列表） |
| 空骨架 | `table: ''` —— `{}` 按钮在尚无值时生成 |

### 工作原理

- **后端**（Rust + minijinja）：解析 `@vars` YAML 块，以 `UndefinedBehavior::Strict` + `AutoEscape::None` 渲染 Jinja 模板，多个变量各有多个值时做笛卡尔积（上限 50 种组合）。
- **前端**（TypeScript）：纯函数帮助库（`src/lib/sql/macros.ts`）负责格式化 YAML 块、合并对话框填写值、构建空骨架。
- 不含 `{{ }}` 占位符的 SQL 不受影响，行为与原来完全一致。

### 批量执行

当某个变量有多个值时（YAML 列表或对话框中多行），系统为每种组合生成一条 SQL 并打开一个结果标签页。所有标签页并行执行。软上限（20）会询问确认；硬上限（50）直接拒绝。

### 工具栏按钮

`{}` 按钮（位于 EXPLAIN 按钮旁）扫描当前选区（无选区则全文）中的 `{{ name }}` 占位符，在 SQL 上方插入或更新 `/* @vars */` 块，缺失变量填入空值。直接在编辑器里修改值然后运行 —— 无需弹窗。

### 键盘快捷键

- `Mod+B` — 切换侧边栏
- `Mod+/` — 快捷键帮助
- `Mod+Enter` — 运行 SQL
- `Mod+Shift+Enter` — 在新标签中运行 SQL
- `Shift+Alt+F` — 格式化文档
- `Mod+K` 然后 `Mod+F` — 格式化选区
- `Mod+W` — 关闭标签
- `F2` — 重命名连接
- `F3` — 连接属性
- `F4` — 打开 SQL 编辑器
- `F5` — 刷新
- `Delete` — 删除连接

（`Mod` 在 Windows/Linux 上为 `Ctrl`，在 macOS 上为 `Cmd`。）

## 开发

### 前置依赖

- Node.js 与 [pnpm](https://pnpm.io/)（仓库使用 `pnpm-lock.yaml`，`npm` / `yarn` 会失败）。
- 用于 Tauri 的 Rust 工具链（`cargo`）。

### 命令

```bash
pnpm install            # 安装依赖（仅限 pnpm）
pnpm dev                # 启动 Vite 开发服务器（http://localhost:5173）
pnpm tauri dev          # 以开发模式运行 Tauri 应用
pnpm build              # 构建前端（Vite -> dist）
pnpm tauri build        # 构建可安装应用
pnpm test               # 运行 Vitest 测试套件
pnpm lint               # 类型检查（tsc）
pnpm i18n:extract       # 提取 i18n 文案（Lingui）
pnpm i18n:compile       # 编译 i18n 目录（Lingui）
```

可选：若要使用 `shandy-sqlfmt` SQL 格式化引擎，请用 `uv tool install shandy-sqlfmt` 安装。

### 技术栈

Tauri 2（Rust workspace） · React 19 + TypeScript + Vite · Monaco 编辑器 · VisActor VTable（基于 Apache Arrow 传输） · Zustand + Jotai · Tailwind CSS v4 · Lingui i18n（英文 / 简体中文） · 跨平台（Windows / macOS / Linux）。

## Q&A

在 Windows 上，DuckDB 需要 [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170) 包作为构建时和**运行时**依赖项。如果 DuckDB 相关功能异常，可能就是此依赖项的问题，需要自行下载安装修复。详见 [《构建 DuckDB》](https://duckdb.org/docs/stable/dev/building/windows)。
