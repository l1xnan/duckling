# AGENTS.md — Duckling contributor / AI coding guide

This file is the source of truth for **how to change this repo**. Prefer matching existing patterns over inventing new stacks.

## Project snapshot

Duckling is a **Tauri 2** desktop app for browsing files/databases and running SQL.

| Layer | Stack |
|-------|--------|
| Frontend | React 19, TypeScript, Vite 8, path alias `@/` → `src/` |
| UI | Tailwind CSS **v4**, shadcn-style components (**Base UI** / `components.json` style `base-vega`), Lucide icons |
| State | Zustand (persist) + Jotai; dual-write durable config via `@tauri-apps/plugin-store` |
| i18n | **Lingui** (`en` source, `zh-CN`) |
| Editor / grid | Monaco, VisActor VTable |
| Backend | Rust workspace: `src-tauri` (Tauri commands) + `connector` (DB dialects) |
| Package manager | **pnpm only** (`pnpm-lock.yaml`) |

## Commands (always use these)

```bash
pnpm install              # never npm/yarn for app deps
pnpm dev                  # Vite only (web preview)
pnpm tauri dev            # full desktop app
pnpm build                # frontend production build
pnpm tauri build          # installable app
pnpm test                 # Vitest (tests/ + co-located *.test.ts)
pnpm lint                 # tsc -- typecheck
pnpm i18n:extract         # lingui extract --clean
pnpm i18n:compile         # compile catalogs (generated .mjs is gitignored)
```

Rust:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
# or from workspace root after install:
cargo test -p connector   # when changing connector
```

After non-trivial TS changes: run **`pnpm lint`** and relevant **`pnpm test`**.  
After user-visible string changes: **`pnpm i18n:extract`**, fill **zh-CN**, then **`pnpm i18n:compile`**.

## Package management

- Use **pnpm** for all frontend dependencies and scripts.
- Do not introduce `package-lock.json` / `yarn.lock` for the app.
- Prefer existing deps (`radash`, `es-toolkit`, `nanoid`, `zod`, `sonner`) before adding new ones.
- UI primitives: extend `@/components/ui/*` and `@/components/custom/*`; do not reintroduce Radix if Base UI already covers the case.

## TypeScript / React conventions

- Path alias: `@/...` (see `vite.config.ts`).
- Prefer functional components and existing store hooks (`useTabsStore`, `useSettingStore`, workspace atoms, etc.).
- **Do not add comments** unless the user asks or the logic is non-obvious and has no better name.
- Match local style: imports, naming, file placement.
- Toasts: `sonner` (`toast.success` / `toast.error`).
- Hotkeys: register in `src/hotkeys/registry.ts` and wire via `useAppHotkey` / Monaco actions as existing code does.

### Layout / flex (common pitfall)

Nested flex + scroll/canvas areas need **`min-h-0 min-w-0 overflow-hidden`** on the chain so children can shrink.  
Result grids (VTable) and split panes are sensitive to missing containment and **subpixel** width; see `tableSizeAntiJitter` on ListTable options when touching tables.

## Tailwind CSS v4

This project uses **Tailwind v4** via `@tailwindcss/vite` and CSS-first config in `src/app/globals.css`.

**Do:**

- Use `@import 'tailwindcss'`, `@theme { ... }`, `@plugin`, `@custom-variant` as in `globals.css`.
- Prefer utility classes already used in the codebase (`size-*`, `min-h-0`, `bg-background`, `text-muted-foreground`, `ring-foreground/10`, etc.).
- Use design tokens / CSS variables from `@theme` and existing shadcn tokens.
- Compose classes with `cn()` from `@/lib/utils`.

**Do not:**

- Add or revive a classic **`tailwind.config.js` / v3-style** config as the source of truth.
- Use deprecated v3-only patterns when a v4 equivalent exists (e.g. avoid inventing new `@tailwind base/components/utilities` pipelines).
- Hard-code one-off colors that ignore theme tokens unless matching nearby code.

## Internationalization (Lingui) — mandatory for UI text

User-visible English strings must go through Lingui.

| Context | API |
|---------|-----|
| JSX text | `<Trans>...</Trans>` from `@lingui/react/macro` |
| Attributes / non-JSX | `const { t } = useLingui()` then `t\`...\`` |
| Module-level labels | `msg\`...\`` from `@lingui/core/macro` + `_(msg)` at render |

Rules:

1. Import macros from **`@lingui/react/macro`** / **`@lingui/core/macro`** (not bare `@lingui/react` for `Trans`/`t`).
2. After adding/changing copy: `pnpm i18n:extract`, translate empty `msgstr` in `src/locales/zh-CN/messages.po`, then `pnpm i18n:compile`.
3. **Commit `.po` files only.** Compiled `src/locales/**/*.mjs` are gitignored.
4. Source locale is **en**; always fill **zh-CN** for new messages (do not leave `msgstr ""` for shipped UI).
5. Prefer clear message text; avoid complex expressions inside macros (extract placeholders cleanly).

## Testing

- Framework: **Vitest** (`pnpm test`). Config lives in `vite.config.ts` (`globals: true`, `environment: 'node'`).
- Place unit tests under **`tests/`** (preferred for stores/libs) or co-located `*.test.ts` when matching existing patterns (`src/ast`, etc.).
- Mock `localStorage` / Tauri `invoke` like existing tests (`tests/tabsStore.test.ts`, `tests/scratchSql.test.ts`).
- When changing behavior in stores, SQL helpers, migration, or IPC wrappers: **add or update tests**.
- Do not rely only on manual checks for pure logic.

## Persistence & secrets (do not regress)

Durable app data lives under the Tauri **app data dir** (Windows: `%APPDATA%\com.duckling.dev\`).

| Data | Mechanism |
|------|-----------|
| Settings | `settings.json` via `tauriFileStorage` |
| Connections (no secrets) | `connections.json` |
| SSH profiles (no secrets) | `ssh-profiles.json` |
| Tabs / layout | `tabs.json` |
| Folders, bookmarks, runs, favorites | `workspace.json` |
| Scratch SQL | `scratch/{id}.sql` |
| Secrets | OS keyring + vault under app data — **never** put passwords in connections JSON or logs |

- Prefer **`createTauriFileStorage`** dual-write (file + localStorage backup) for new durable zustand state.
- Scratch SQL: disk is source of truth; debounce writes; flush on unmount.
- Folder SQL files: **explicit Save** (not auto-write) unless product requirements change.
- Never commit secrets, tokens, or real connection passwords.

## Frontend structure (where to put code)

```
src/
  api.ts              # Tauri invoke wrappers
  components/         # UI (ui/ = primitives, custom/, editor/, tables/, views/)
  pages/              # Feature screens (editor, sidebar, settings)
  stores/             # Zustand / Jotai / tauri storage adapters
  lib/                # Pure helpers (sql, scratch, history, …)
  hotkeys/            # Registry + bindings
  locales/            # Lingui catalogs (.po)
src-tauri/src/cmd/    # Tauri commands (app, db, secrets, …)
connector/            # Rust DB connectors
tests/                # Vitest suite
```

- New Tauri commands: implement in `src-tauri`, register in `main.rs`, expose thin wrappers in `src/api.ts`.
- Keep IPC DTOs serializable and free of secrets unless going through `secret_store`.

## Rust conventions

- Workspace members: `src-tauri`, `connector`.
- Prefer small, tested pure functions in `connector` for dialect SQL/behavior.
- Log with existing `log` macros; do not print secrets.
- Sanitize filenames/ids before writing under app data (see scratch / vault helpers).

## Git & commits

- Conventional commits: `feat|fix|chore|refactor|test|docs|style(scope): summary`.
- One logical change per commit when possible.
- Do not commit unless the user asks (except when the user explicitly requests commits).
- Do not force-push `main` or rewrite shared history.

## What not to do

- Do not use **npm/yarn** for this app’s dependency tree.
- Do not ship UI strings without Lingui + zh-CN.
- Do not store secrets in plain connection profiles or localStorage-only blobs.
- Do not “fix” layout by removing `min-h-0` / `overflow-hidden` without understanding flex + VTable.
- Do not add large dependencies for one-liners already covered by `radash` / `es-toolkit` / stdlib.
- Do not commit generated Lingui `.mjs` or `target/` / `dist/` / `.env`.

## Quick checklist before finishing a task

- [ ] `pnpm lint` clean for touched TS (ignore pre-existing unrelated errors if any)
- [ ] Tests added/updated and `pnpm test` for affected files
- [ ] UI strings: extract + zh-CN + compile
- [ ] Persistence path chosen correctly (app data vs session-only)
- [ ] Tailwind utilities match v4 / existing tokens
- [ ] No secrets in logs or committed files
