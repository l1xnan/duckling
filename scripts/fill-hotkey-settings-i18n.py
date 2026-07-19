#!/usr/bin/env python3
"""Fill empty zh-CN msgstr for hotkey settings UI."""

from __future__ import annotations

import re
from pathlib import Path

path = Path("src/locales/zh-CN/messages.po")
text = path.read_text(encoding="utf-8")

tr: dict[str, str] = {
    "Built-in": "内置",
    "Click a shortcut to record a new combination. Built-in editor and table shortcuts cannot be remapped here.": "点击快捷键开始录制新组合。编辑器与表格内置快捷键无法在此修改。",
    "Custom": "自定义",
    "default: {0}": "默认：{0}",
    "Press keys…": "请按下按键…",
    "Reset all": "全部重置",
    "Reset to default": "恢复默认",
    "Shortcut updated": "快捷键已更新",
    "Shortcuts restored to defaults": "已恢复默认快捷键",
    "Some shortcuts share the same keys within a scope. Resolve conflicts by reassigning one of them.": "同一作用域内存在冲突的快捷键，请重新分配其中一个。",
    "This shortcut is built into the editor or table and cannot be changed.": "此快捷键由编辑器或表格内置，无法修改。",
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
    print(repr(x[:120]))
