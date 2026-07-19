#!/usr/bin/env python3
"""Fill empty zh-CN msgstr entries for recently added UI strings."""

from __future__ import annotations

import re
from pathlib import Path

path = Path("src/locales/zh-CN/messages.po")
text = path.read_text(encoding="utf-8")

tr: dict[str, str] = {
    "(empty)": "（空）",
    "{0} distinct value(s)": "{0} 个不同值",
    "{0} distinct value(s) (capped at 1000)": "{0} 个不同值（上限 1000）",
    "{0} of {1} runs": "{0} / {1} 条运行记录",
    "{0} rows": "{0} 行",
    "{0} run(s)": "{0} 条运行记录",
    "{day}d ago": "{day} 天前",
    "{hr}h ago": "{hr} 小时前",
    "{min}m ago": "{min} 分钟前",
    "{sec}s ago": "{sec} 秒前",
    "Accept new keys": "接受新密钥",
    "Add": "添加",
    "Apply filter to WHERE": "应用到 WHERE",
    "Bookmark": "书签",
    "Bookmark SQL": "收藏 SQL",
    "Bookmarked": "已收藏",
    "Chart": "图表",
    "Clear all history": "清空全部历史",
    "Clear filter": "清除筛选",
    "Clear search": "清除搜索",
    "Clear sort": "清除排序",
    "Close idle database sessions (connection pools, SSH tunnels) after this many minutes. Use 0 to keep sessions until the app exits or the connection is removed.": "空闲多少分钟后关闭数据库会话（连接池、SSH 隧道）。设为 0 则保持到应用退出或连接被移除。",
    "Column profile": "列画像",
    "Column profile: <0>{column}</0>": "列画像：<0>{column}</0>",
    "Connection not found": "未找到连接",
    "Copy as Markdown": "复制为 Markdown",
    "Could not resolve table for this view": "无法解析此视图的表",
    "Count by column": "按列计数",
    "Count by column: <0>{column}</0>": "按列计数：<0>{column}</0>",
    "Count by this column": "按此列计数",
    "Create": "创建",
    "Delete bookmark": "删除书签",
    "Describe table": "描述表",
    "Disable": "禁用",
    "Distinct": "去重数",
    "e.g. Production bastion": "例如：生产跳板机",
    "elapsed: {elapsed}ms": "耗时：{elapsed}ms",
    "Empty SQL": "SQL 为空",
    "EXPLAIN": "EXPLAIN",
    "Export cancelled": "导出已取消",
    "Export is not supported for this connection": "此连接不支持导出",
    "Filter by this value": "按此值筛选",
    "Filter results…": "筛选结果…",
    "From ~/.ssh/config": "来自 ~/.ssh/config",
    "Host key": "主机密钥",
    "Manage reusable tunnels in Settings → SSH Profiles.": "可在 设置 → SSH 配置文件 中管理可复用隧道。",
    "Manual configuration": "手动配置",
    "Max": "最大值",
    "Min": "最小值",
    "No data": "无数据",
    "No matching history": "无匹配历史",
    "No query history yet": "暂无查询历史",
    "No rows": "无行",
    "No SSH profiles yet.": "暂无 SSH 配置文件。",
    "Nulls": "空值",
    "Open in editor": "在编辑器中打开",
    "Open in new editor": "在新编辑器中打开",
    "pending": "进行中",
    "Query cancelled": "查询已取消",
    "Query failed": "查询失败",
    "Require": "要求",
    "Sample 100 rows": "采样 100 行",
    "Save": "保存",
    "Save bastion hosts once, then reuse them when adding MySQL or Postgres connections.": "先保存跳板机，添加 MySQL 或 Postgres 连接时可复用。",
    "Search history…": "搜索历史…",
    "Select a saved SSH profile": "选择已保存的 SSH 配置",
    "Session idle timeout (minutes)": "会话空闲超时（分钟）",
    "Sort ascending": "升序排序",
    "Sort descending": "降序排序",
    "SQL bookmarks": "SQL 书签",
    "SSH host and username are required": "SSH 主机和用户名为必填",
    "SSH Profile": "SSH 配置",
    "SSH profile created": "SSH 配置已创建",
    "SSH profile deleted": "SSH 配置已删除",
    "SSH profile updated": "SSH 配置已更新",
    "SSH Profiles": "SSH 配置文件",
    "SSH Tunnel Profiles": "SSH 隧道配置",
    "SSL": "SSL",
    "Stop": "停止",
    "Stop query": "停止查询",
    "Strict (known_hosts)": "严格（known_hosts）",
    "Top values": "高频值",
    "Total": "总计",
    "Trust all (insecure)": "信任全部（不安全）",
    "Unknown": "未知",
}

pattern = re.compile(
    r'((?:#.*\n)*)(msgid "(?:[^"\\]|\\.)*"'
    r'(?:\n"(?:[^"\\]|\\.)*")*)\n'
    r'(msgstr "(?:[^"\\]|\\.)*"(?:\n"(?:[^"\\]|\\.)*")*)',
    re.MULTILINE,
)


def po_string(block: str) -> str:
    parts = re.findall(r'"((?:\\.|[^"\\])*)"', block)
    out: list[str] = []
    for p in parts:
        out.append(
            p.replace(r"\n", "\n")
            .replace(r"\t", "\t")
            .replace(r"\"", '"')
            .replace(r"\\", "\\")
        )
    return "".join(out)


def escape_po(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


missing: list[str] = []


def repl(m: re.Match[str]) -> str:
    comments, msgid_b, msgstr_b = m.group(1), m.group(2), m.group(3)
    mid = po_string(msgid_b)
    mstr = po_string(msgstr_b)
    if mid == "" or mstr != "":
        return m.group(0)
    if mid in tr:
        return f'{comments}{msgid_b}\nmsgstr "{escape_po(tr[mid])}"'
    missing.append(mid)
    return m.group(0)


new_text = pattern.sub(repl, text)
path.write_text(new_text, encoding="utf-8")
print(f"filled known translations; still missing: {len(missing)}")
for x in missing:
    print(repr(x[:160]))
