# Duckling docs site

Rspress documentation site for [Duckling](https://github.com/l1xnan/Duckling), managed as the `website` package in the repo's pnpm workspace.

## Languages

Content lives under `docs/en/` (default) and `docs/zh/` with mirrored structure. Add pages in both locales and keep navigation (`_nav.json`) and sidebars (`_meta.json`) in sync. New user-visible strings must be translated in both locales.

## Setup

```bash
pnpm install        # from the repo root (pnpm workspace)
```

## Run commands

Run from the repo root via the workspace scripts, or directly in `website/`:

```bash
pnpm docs:dev       # Rspress dev server
pnpm docs:build     # static site build -> doc_build/
pnpm docs:preview   # preview the built site
pnpm run format     # Prettier (from website/)
```

## Static assets

Files that need stable URLs (screenshots, logos) live in `docs/public/` and are referenced with an absolute path, e.g. `/screenshot.png`.

## Known dependency note

`pnpm-workspace.yaml` at the repo root pins `style-to-js` to `2.0.2` because `hast-util-to-estree@3.1.3` bare-imports `style-to-js`, whose 1.x is CJS-only and breaks under native ESM. Do not remove that override while the docs build is expected to pass.
