# UI 紧凑化 + 品牌色改进 Plan

> 目标：解决表单/按钮尺寸与紧凑主界面不协调的问题，同时修正朴素感（引入鸭黄 accent、修暗色层级、调圆角）。

---

## Phase 1 — 收缩 UI 原语默认尺寸（核心）

直接修改 `src/components/ui/` 下的原语组件，使表单控件高度从 h-9（~34px）降至 h-8（~30px），与主界面工具栏对齐。

### 1.1 Button（`src/components/ui/button.tsx`）

| size    | 当前                 | 改为                 |
| ------- | -------------------- | -------------------- |
| default | `h-9 gap-1.5 px-2.5` | `h-8 gap-1.5 px-2.5` |
| sm      | `h-8`                | `h-7`                |
| lg      | `h-10`               | `h-9`                |
| icon    | `size-9`             | `size-8`             |
| icon-sm | `size-8`             | `size-7`             |
| icon-lg | `size-10`            | `size-9`             |
| icon-xs | `size-6`             | 不变                 |
| xs      | `h-6`                | 不变                 |

> 说明：sm 和 icon-sm 现在比默认更小一档，工具栏 TooltipButton 用 `size-6` 保持不动（那是自定义尺寸）。表单里的 Cancel/Ok 按钮会自动从 34px 变成 30px。

### 1.2 Input（`src/components/ui/input.tsx`）

```diff
- "h-9 w-full ... text-base ... md:text-sm ..."
+ "h-8 w-full ... text-sm ..."
```

- h-9 → h-8
- `text-base` → `text-sm`（桌面应用无需 mobile 防缩放降级，直接 text-sm 一致）
- 去掉 `md:text-sm` trick

### 1.3 SelectTrigger（`src/components/ui/select.tsx`）

```diff
- data-[size=default]:h-9 data-[size=sm]:h-8
+ data-[size=default]:h-8 data-[size=sm]:h-7
```

### 1.4 InputGroup（`src/components/ui/input-group.tsx`）

```diff
- "relative flex h-9 w-full ..."
+ "relative flex h-8 w-full ..."
```

`InputGroupButton` 尺寸（`icon-xs: size-6`）保持不变。

### 1.5 Textarea（`src/components/ui/textarea.tsx`）

```diff
- "flex field-sizing-content min-h-16 ... text-base ... md:text-sm ..."
+ "flex field-sizing-content min-h-14 ... text-sm ..."
```

### 1.6 Label（`src/components/ui/label.tsx`）

```diff
- "flex items-center gap-2 text-sm leading-none font-medium ..."
+ "flex items-center gap-1.5 text-xs font-medium leading-tight ..."
```

> 文字缩小但保持可读性（11.25px @15px root）。如果觉得太小可折中用 `text-[13px]`。

### 1.7 Form 辅助文字（`src/components/ui/form.tsx`）

- `FormDescription`: `text-sm` → `text-xs`
- `FormMessage`: `text-sm` → `text-xs`

### 1.8 Field（`src/components/ui/field.tsx`）

```diff
- FieldSet:       gap-6 → gap-4
- Field:          gap-3 → gap-2
- FieldGroup:     gap-7 → gap-4
- FieldTitle:     text-sm → text-xs
- FieldDescription: text-sm → text-xs
- FieldError:     text-sm → text-xs
```

### 1.9 Dialog（`src/components/ui/dialog.tsx`）

```diff
- DialogContent: "gap-6 ... p-6 ... text-sm"
+ DialogContent: "gap-4 ... p-5 ... text-sm"
```

- 内部 padding 从 24px 降到 20px，间距从 24px 降到 16px
- 标题 CloseButton 位置相应调整 `top-4 right-4` → `top-3.5 right-3.5`

### 1.10 DropdownMenu / ContextMenu / Select 菜单项

**dropdown-menu.tsx**：

```diff
- DropdownMenuLabel:  px-2 py-1.5 text-xs  （已经是 text-xs，不动）
- DropdownMenuItem:   py-1.5 text-sm → py-1 text-xs
- DropdownMenuSubTrigger: py-1.5 text-sm → py-1 text-xs
- DropdownMenuCheckboxItem: py-1.5 text-sm → py-1 text-xs
- DropdownMenuRadioItem: py-1.5 text-sm → py-1 text-xs
```

**context-menu.tsx**：同样模式（py-1.5 text-sm → py-1 text-xs）。

> 这样菜单与主界面 custom/dropdown-menu.tsx（已是 text-xs）和 vtable 菜单（0.75rem）统一。

**select.tsx SelectItem**：

```diff
- py-1.5 pr-8 pl-2 text-sm
+ py-1 pr-8 pl-2 text-xs
```

### 1.11 Tabs（`src/components/ui/tabs.tsx`）

```diff
- tabs-list 水平 h-9
+ h-8
```

`TabsContent` 的 `text-sm` 保持不变（内容区文字无需再缩）。

### 1.12 补充：Combobox（`src/components/ui/combobox.tsx`）

ComboboxInput 使用 InputGroup，已随 1.4 一起降。combobox 搜索输入框在 popup 内的 h-8 也跟着降一档：

```diff
- *:data-[slot=input-group]:h-8
+ *:data-[slot=input-group]:h-7  （popup 内搜索更紧凑）
```

---

## Phase 2 — 表单/对话框布局适配

原语默认尺寸下调后，需要检查各表单的布局间距、显式硬编码尺寸是否需要同步调整。

### 2.1 PageTabs RenameDialog（`src/components/PageTabs.tsx`）

```diff
- <form ... className="space-y-8">
+ <form ... className="space-y-4">
```

> space-y-8（32px）→ space-y-4（16px），配合更小的表单控件。

### 2.2 设置页（`src/pages/settings/AppSetting.tsx`）

- 所有 `<Button>` 无显式 size 的，自动跟随新默认 h-8
- 所有 `<Input>`、`<SelectTrigger>` 自动跟随 h-8
- `space-y-4` 不变（已经合理）
- `DialogFooter` 的 `border-t pt-4` 不变

### 2.3 连接表单（`src/pages/sidebar/dialog/DatabaseDialog.tsx`）

- 13 个 `<Input>` / `<SelectTrigger>` 自动跟随 h-8
- 显式带 `size="xs"` / `size="sm"` 的按钮保持不变（DatabaseDialog 里已有 3 处 compact 按钮）
- 检查 SSH 配置区块的嵌套间距

### 2.4 ConfigDialog（`src/pages/sidebar/dialog/ConfigDialog.tsx`）

- `<Button variant="secondary">Cancel</Button>` 等自动变 h-8
- `min-w-[800px]` 不变（内容宽度够）

### 2.5 导出对话框（`src/components/views/ExportDialog.tsx`）

- 1 个 `<Input>`，2 个 `<Button>` 自动跟随

### 2.6 PivotDialog（`src/components/views/PivotDialog.tsx`）

- 已有 9 个 compact 按钮（size="xs"/"sm"），3 个 default Input → 自动 h-8
- 检查 mixed 情况下视觉一致性

### 2.7 其他对话框

- `SearchDialog`、`RenameDialog`、`ConnectionTransferDialog`、`ColumnProfileDialog`、`CountByColumnDialog`、`CountByQueryDialog` — 各自有 1-3 个表单控件，自动跟随新默认

### 2.8 Pagination（`src/components/custom/pagination.tsx`）

```diff
- <span className="mr-1 text-sm">
+ <span className="mr-1 text-xs">
```

### 2.9 Settings Item 按钮

`AppSetting.tsx` 里的 `Item` 组件按钮（如"Open folder"）无显式 size，自动 h-8。

---

## Phase 3 — 主题美化

### 3.1 Light 主题品牌色（`src/app/globals.css`）

```css
:root {
  --primary: hsl(220 70% 52%); /* 蓝色主按钮 */
  --primary-foreground: hsl(0 0% 100%);
  --ring: hsl(220 70% 52%); /* ring 跟随 primary */
  --selection: hsl(48 100% 88%); /* 鸭黄色选中高亮 */
  --accent: hsl(48 100% 94%); /* 浅黄 hover/选中背景 */
  --accent-foreground: hsl(30 80% 30%); /* 深黄棕文字 */
}
```

**设计说明**：

- 主按钮用**深蓝**（#2563eb 区域），有足够对比度做白底黑字按钮，是工具软件最稳的主色
- **鸭黄色**用于：选中行背景 `--selection`、工具栏 active/selected 态、表头 hover、通知 badge、链接下划线 accent
- 不同于全灰主题，有辨识度

### 3.2 Dark 主题修正层级（`src/app/globals.css`）

当前问题：background L=18% > card/popover L=3.9%（弹窗比背景暗），违反 elevation 规则。

```css
.dark {
  --background: hsl(220 10% 12%); /* 最深 — 画布 */
  --card: hsl(220 10% 16%); /* 比背景亮一档 — 卡片/面板 */
  --popover: hsl(220 10% 18%); /* 再亮一档 — 浮层/菜单 */
  --sidebar-background: hsl(220 10% 10%); /* 比背景稍深或同级 — 侧栏 */
  --secondary: hsl(220 10% 18%); /* 与 popover 对齐 */
  --muted: hsl(220 10% 18%); /* 与 secondary 对齐 */
  --border: hsl(220 10% 24%); /* 微妙分界线 */
  --input: hsl(220 10% 24%); /* 与 border 对齐 */

  --primary: hsl(220 80% 60%); /* 亮蓝 — 暗底上的主色 */
  --primary-foreground: hsl(0 0% 100%);
  --ring: hsl(220 80% 60%);

  --selection: hsl(48 80% 35%); /* 暗底鸭黄，高饱和 */
  --accent: hsl(48 40% 20%); /* 暗底浅黄棕 */
  --accent-foreground: hsl(48 80% 80%);
}
```

**关键改变**：

- `background`(12%) < `card`(16%) < `popover`(18%)：**弹窗浮在背景之上**，视觉上是"浮起"而不是"挖洞"
- sidebar-background 比背景更深（10%）：侧栏沉入，主内容区浮起
- primary 从近黑(10%) → 亮蓝(60%)：暗底上的蓝比灰更有层次

### 3.3 统一 Sidebar 变量（`src/app/globals.css`）

当前 sidebar CSS 变量在两个地方重复定义（`@layer base :root` 内 + 独立 `:root/.dark` 块）。合并到一处，并确保使用 hsl 函数而非旧版 space-separated 格式，与主题变量风格统一。

删除 `globals.css` 末尾的重复 sidebar 定义块（172-203 行），只保留 `@layer base` 内的定义。

### 3.4 圆角（`src/app/globals.css`）

```diff
- --radius: 0.3rem;   /* ~4.5px */
+ --radius: 0.5rem;   /* ~7.5px */
```

> 比 shadcn 默认 0.5rem 不变（shadcn 默认就是 0.5rem），但项目改成了 0.3rem。改回去后按钮/输入框/卡片边缘更柔和。如果觉得太圆可折中 0.4rem。

### 3.5 VTable 主题接 CSS 变量（`src/components/tables/theme.ts`）

当前表格主题硬编码了颜色（LIGHT_THEME 的 `#9cbef4` hover、DARK_THEME 的 `#282a2e` 等）。改为从 CSS 变量推导。

```ts
// 需要在运行时读取 CSS 变量（非 build-time）
// 方案：通过 document.documentElement 的 computed style 读取
function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
```

改动点：

- LIGHT_THEME bodyStyle hover → 使用 `--accent` / `--selection` 色值（鸭黄色）
- DARK_THEME bodyStyle bgColor → 使用基于 `--background` 计算的斑马纹色
- headerStyle bgColor → 使用 `--secondary` / `--muted`
- borderColor → 使用 `--border`

> 注意：表格主题在 `makeTableTheme()` 时调用，此时 DOM 已加载，getComputedStyle 可用。需要在颜色模式切换时重建主题（现有代码已通过 isDark 参数在 theme 切换时重建）。

### 3.6 清理死代码（`src/styles.css`）

- 删除 91-127 行注释掉的 scrollbar CSS
- 删除 11-20 行 `.vtable__menu-element` 第一个定义（与 58-68 行重复）

---

## Phase 4 — 组件整合

### 4.1 统一 TooltipButton

当前存在两个实现：

- `src/components/custom/button.tsx` — TooltipButton，使用 TooltipProvider delay={0}
- `src/components/custom/tooltip.tsx` — TooltipButton，使用 DelayedTooltip delay={1000}

**保留 `custom/tooltip.tsx` 版本**（DelayedTooltip），删除 `custom/button.tsx` 中的 TooltipButton，更新所有 import。

受影响文件（通过 Grep `<TooltipButton` 找到的引用）：

- src/components/custom/button.tsx（定义）
- src/components/views/DataViewToolbar.tsx
- src/pages/sidebar/SqlCode.tsx
- src/pages/sidebar/dialog/DatabaseDialog.tsx
- src/pages/sidebar/dialog/RenameDialog.tsx
- src/pages/sidebar/dialog/SearchDialog.tsx
- src/components/views/CountByColumnDialog.tsx
- src/components/views/CountByQueryDialog.tsx
- src/components/views/ExportDialog.tsx
- src/components/views/PivotDialog.tsx
- src/pages/settings/SshProfilesForm.tsx
- src/pages/settings/HotkeysForm.tsx
- src/components/custom/pagination.tsx

### 4.2 删除冗余的 custom/dropdown-menu.tsx

Phase 1 修改后，`ui/dropdown-menu.tsx` 的菜单项已是 text-xs + py-1，与 `custom/dropdown-menu.tsx` 对齐。如果 custom 版只是样式覆盖（确认一下），可以直接删除并更新 import。

**需确认**：custom/dropdown-menu.tsx 是否有逻辑差异（如 `onSelect` → `onClick` 适配）。如有逻辑包装，保留但去掉 className 覆盖。

### 4.3 图标尺寸规范（文档化）

| 场景                         | 尺寸 | 类名       |
| ---------------------------- | ---- | ---------- |
| 工具栏按钮图标               | 16px | `size-4`   |
| 工具栏特殊图标（浮点精度等） | 20px | `size-5`   |
| 菜单项图标                   | 14px | `size-3.5` |
| 表单输入框前缀图标           | 16px | `size-4`   |
| 树/侧栏图标                  | 16px | `size-4`   |
| 状态栏图标                   | 14px | `size-3.5` |

---

## Phase 5（可选）— 密度设置

如果未来需要支持 Compact / Comfortable 两种密度，可以在设置 store 增加 `density: 'compact' | 'comfortable'` 选项，通过 CSS 变量驱动尺寸：

```css
:root {
  --control-h: 32px; /* compact */
}
.comfortable {
  --control-h: 36px;
}
```

各 UI 组件用 `h-(--control-h)` 替代硬编码。**当前 Phase 1-4 已满足紧凑需求，此项按需延后。**

---

## 改动文件汇总

### Phase 1 — UI 原语（12 个文件）

- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/input-group.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/form.tsx`
- `src/components/ui/field.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/context-menu.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/combobox.tsx`

### Phase 2 — 布局适配（~10 个文件）

- `src/components/PageTabs.tsx`
- `src/components/custom/pagination.tsx`
- `src/pages/settings/AppSetting.tsx`
- `src/pages/sidebar/dialog/DatabaseDialog.tsx`
- `src/pages/sidebar/dialog/ConfigDialog.tsx`
- `src/pages/sidebar/dialog/SearchDialog.tsx`
- `src/pages/sidebar/dialog/RenameDialog.tsx`
- `src/pages/sidebar/dialog/ConnectionTransferDialog.tsx`
- `src/components/views/ExportDialog.tsx`
- `src/components/views/PivotDialog.tsx`
- `src/components/views/ColumnProfileDialog.tsx`
- `src/components/views/CountByColumnDialog.tsx`
- `src/components/views/CountByQueryDialog.tsx`

> 大部分文件无需改动或仅删一处显式尺寸（Phase 1 已覆盖）。主要检查 space-y-8 → space-y-4 等间距。

### Phase 3 — 主题（4 个文件）

- `src/app/globals.css` — 色板 + 圆角 + 变量去重
- `src/styles.css` — 死代码清理
- `src/components/tables/theme.ts` — VTable 色彩接变量

### Phase 4 — 组件整合（~13 个文件）

- `src/components/custom/button.tsx` — 删除 TooltipButton
- `src/components/custom/tooltip.tsx` — 保留（唯一 TooltipButton）
- `src/components/custom/dropdown-menu.tsx` — 视情况删除
- 其余 ~10 个文件 import 路径更新

---

## 验证清单

- [ ] `pnpm dev` 启动后走查：主窗口工具栏/标签栏/树/状态栏无变化（本来就是紧凑的）
- [ ] 设置对话框（所有标签页）：输入框/Select/按钮高度一致且不拥挤
- [ ] 新建/编辑连接对话框：表单字段高度一致，底部按钮间距合理
- [ ] 搜索对话框、重命名对话框：表单无溢出
- [ ] 右键菜单/下拉菜单：菜单项高度与 vtable 菜单一致
- [ ] 导出/透视表对话框：mixed size 场景视觉统一
- [ ] Light 主题：主按钮为蓝色，选中行为鸭黄色，整体不再灰蒙蒙
- [ ] Dark 主题：弹窗浮在背景之上（不再比背景暗），侧栏最深，主内容区中间层
- [ ] 表格 hover/选中色与 app 主题色一致
- [ ] VTable 菜单/Tooltip 样式无变化（styles.css 清理不影响功能性）
- [ ] `pnpm build` 无报错

---

# TypeScript 编译告警清理计划

当前 `npx tsc --noEmit` 共 **88 个错误**，按类型分 5 类：

## 一、模块解析 TS2307（18 个）

| 模块 | 涉及文件 | 解决方案 |
|------|----------|----------|
| `monaco-editor/esm/vs/editor/editor.api` | completion.ts, monacoConfig.ts, useRegister.tsx | 添加 `declare module` 声明或配置 `paths` |
| `monaco-sql-languages/esm/*` | duckdb.contribution.ts, duckdb.ts, duckdb.worker.ts, duckdbWorker.ts | 同上，或检查包是否提供 types |
| `dt-sql-parser/dist/parser/postgresql` | duckdbWorker.ts | 添加 `declare module` |
| `../common/constants`, `../fillers/monaco-editor-core` | languages/duckdb/duckdb.ts | 检查 `monaco-sql-languages` 包结构，修正路径 |
| `@/components/hooks/use-toast` | toaster.tsx | 修正为 `@/hooks/use-toast` |

## 二、类型不兼容 TS2322/TS2430（19 个）

| 问题 | 涉及文件 | 解决方案 |
|------|----------|----------|
| `Event` vs `BaseUIEvent<MouseEvent>` | TableContextMenu (7), SchemaContextMenu (2) | 事件处理器参数类型改为 `BaseUIEvent<MouseEvent>` |
| `ContextMenuItemProps` extends 错误 | context-menu.tsx (1) | 修正接口继承，移除冲突的 `onClick`/`onSelect` |
| `onClick` 不在 ContextMenuItemProps | PageTabs.tsx (6) | 改用 `onSelect` 或修正组件 props |
| DialogProps 缺少 `title`/`children` | TableContextMenu (1), ConnectionContextMenu (1) | 补充缺失的 props |
| Toast 类型不匹配 | use-toast.ts (2), toaster.tsx (1) | 修正 ToastRootProps 类型 |
| IconButtonProps 不匹配 | pagination.tsx (2) | 检查 IconButton 组件 props 定义 |
| Tooltip ReactNode 类型 | tooltip.tsx (2) | 改用正确的 children 类型 |

## 三、未使用变量 TS6133（15 个）

| 文件 | 变量 | 解决 |
|------|------|------|
| analyze.test.ts | `CompleteMetaType` | 删除 import |
| PageTabs.tsx | `isActive` | 删除 |
| CanvasTable.tsx | `rowSeriesNumber`, `contextMenuItems`, `_handleFieldFormat`, `handleDropdownMenuClick` | 删除或前缀 `_` |
| scroll-area.tsx | `React` | 删除 import |
| siderbar-nav.tsx | `props` | 删除或使用 |

## 四、null 安全 TS18047（13 个，均在 analyze.test.ts）

测试中 `tree.rootNode` 可能为 null。加 `!` 非空断言或 `expect(tree).toBeTruthy()` 后再访问。

## 五、隐式 any TS7006/TS7031（11 个）+ 其他（6 个）

| 文件 | 错误 | 解决 |
|------|------|------|
| monacoConfig.ts (7) | TS7006 参数隐式 any | 给回调参数加类型注解 |
| toaster.tsx (4) | TS7031 解构隐式 any | 给解构参数加类型 |
| highlight-header-when-select-cell.ts | TS2564 未初始化 / TS2345 undefined→string | 加 `!` 或默认值 |
| form.tsx | TS2769 overload 不匹配 | 检查表单组件类型 |

## 实施顺序

1. **快速修复**：未使用变量（TS6133）、null 断言（TS18047）— 改动小、风险低
2. **路径修复**：错误的 import 路径（toaster.tsx）
3. **类型声明**：Monaco/SQL 模块的 `declare module`（TS2307）
4. **组件类型**：ContextMenu/Dialog/Toast 类型兼容（TS2322/TS2430）
5. **参数注解**：隐式 any（TS7006/TS7031）
