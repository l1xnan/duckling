#!/usr/bin/env python3
"""Fill empty zh-CN msgstr for hotkey-related strings."""

from __future__ import annotations

import re
from pathlib import Path

path = Path("src/locales/zh-CN/messages.po")
text = path.read_text(encoding="utf-8")

tr: dict[str, str] = {
    "Close tab": "关闭标签页",
    "Connection properties": "连接属性",
    "Copy selection": "复制选区",
    "Database tree": "数据库树",
    "Delete connection": "删除连接",
    "Format document": "格式化文档",
    "Format document ({0})": "格式化文档（{0}）",
    "Format selection": "格式化选区",
    "Format selection ({0})": "格式化选区（{0}）",
    "Format Selection": "格式化选区",
    "General": "通用",
    "Keyboard shortcuts": "键盘快捷键",
    "Open SQL editor": "打开 SQL 编辑器",
    "Rename connection": "重命名连接",
    "Run ({0})": "运行（{0}）",
    "Run in new tab ({0})": "在新标签页运行（{0}）",
    "Run SQL": "运行 SQL",
    "Run SQL in new tab": "在新标签页运行 SQL",
    "Toggle sidebar": "切换侧边栏",
}

pattern = re.compile(
    r'((?:#.*\n)*)(msgid "(?:[^"\\]|\\.)*"(?:\n"(?:[^"\\]|\\.)*")*)\n'
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
print(f"still missing: {len(missing)}")
for x in missing:
    print(repr(x))
