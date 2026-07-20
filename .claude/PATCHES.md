# shadcn/ui 组件自定义改动清单

## 架构说明

```
src/components/ui/          ← shadcn 组件 + 紧凑尺寸覆写（直接修改）
src/components/custom/ui/   ← 薄包装层（re-export from ui/），未来 shadcn 更新后在此加覆写
src/components/custom/      ← 业务级包装组件
```

**当前阶段**：紧凑覆写直接写在 `ui/` 中。`custom/ui/` 是空的 re-export 层。

**shadcn 更新后**：`ui/` 被覆盖回默认值 → 将覆写移到 `custom/ui/` 中（用 className 覆盖），应用代码切换到从 `custom/ui/` 导入。

---

## ui/ 组件改动清单

### `src/components/ui/button.tsx`

```
default: h-9 → h-8 (30px)
sm:      h-8 → h-7
lg:      h-10 → h-9
icon:    size-9 → size-8
icon-sm: size-8 → size-7
icon-lg: size-10 → size-9
```

### `src/components/ui/input.tsx`

```
h-9 → h-8
text-base → text-sm（去掉 md:text-sm）
focus-visible: ring-3 ring-ring/50 → 删除
```

### `src/components/ui/select.tsx`

SelectTrigger:
```
data-[size=default]:h-9 → h-8
data-[size=sm]:h-8 → h-7
focus-visible ring → 删除
```

SelectItem:
```
py-1.5 text-sm → py-1 text-xs
```

### `src/components/ui/input-group.tsx`

```
h-9 → h-8
focus-visible ring → 删除
```

### `src/components/ui/textarea.tsx`

```
min-h-16 → min-h-14
text-base → text-sm
focus-visible ring → 删除
```

### `src/components/ui/label.tsx`

```
gap-2 text-sm → gap-1.5 text-xs
leading-none → leading-tight
```

### `src/components/ui/form.tsx`

FormDescription/FormMessage: `text-sm` → `text-xs`

### `src/components/ui/field.tsx`

```
FieldSet:        gap-6 → gap-4
Field:           gap-3 → gap-2
FieldGroup:      gap-7 → gap-4
FieldTitle/Desc/Error: text-sm → text-xs
```

### `src/components/ui/dialog.tsx`

```
p-6 → p-5
gap-6 → gap-4
```

### `src/components/ui/dropdown-menu.tsx`

所有菜单项: `py-1.5 text-sm` → `py-1 text-xs`

### `src/components/ui/context-menu.tsx`

所有菜单项: `py-1.5 text-sm` → `py-1 text-xs`

### `src/components/ui/tabs.tsx`

tabs-list: `h-9` → `h-8`

### `src/components/ui/combobox.tsx`

popup 搜索框: `h-8` → `h-7`

---

## 主题色相关

`src/app/globals.css` 中的 CSS 变量是主题核心，更新 shadcn 不会覆盖此文件。

关键改动：
- primary: 近黑色 → 蓝色 `hsl(220 70% 52%)`
- accent: 灰色 → 鸭黄色 `hsl(48 100% 94%)`
- selection: 灰色 → 鸭黄色 `hsl(48 100% 88%)`
- radius: `0.3rem` → `0.5rem`
- dark elevation: background(10%) < card(14%) < popover(17%)
