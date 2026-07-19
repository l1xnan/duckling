import { useMemo, useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useLingui } from '@lingui/react/macro';
import {
  ChevronRight,
  DatabaseIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { nanoid } from 'nanoid';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  filterHistory,
  formatAbsoluteTime,
  formatElapsedMs,
  formatRelativeTime,
  groupHistoryByConnection,
  isHistoryError,
  normalizeHistoryItem,
  sqlVerb,
  summarizeSql,
  type QueryHistoryItem,
} from '@/lib/queryHistory';
import { HistoryContextMenu } from '@/pages/sidebar/context-menu/HistoryContextMenu';
import { docsAtom, runsAtom } from '@/stores/app';
import { getStoredDB } from '@/stores/dbList';
import { useTabsStore } from '@/stores/tabs';

import { Container } from './Favorite';

function connectionLabel(dbId: string): string {
  if (!dbId || dbId === '__unknown__') return 'Unknown';
  const db = getStoredDB(dbId);
  if (!db) return dbId.slice(0, 8) + (dbId.length > 8 ? '…' : '');
  return db.displayName || db.dialect || dbId;
}

function connectionDialect(dbId: string): string | undefined {
  return getStoredDB(dbId)?.dialect;
}

function HistoryItemRow({
  item,
  onOpen,
}: {
  item: QueryHistoryItem;
  onOpen: (item: QueryHistoryItem) => void;
}) {
  const err = isHistoryError(item);
  const verb = sqlVerb(item.stmt);
  const summary = summarizeSql(item.stmt, 64);
  const elapsed = formatElapsedMs(item.elapsed);
  const when = formatRelativeTime(item.createdAt);
  const abs = formatAbsoluteTime(item.createdAt);
  const rows =
    item.total != null && !Number.isNaN(item.total)
      ? `${item.total} rows`
      : null;

  const detailParts = [
    abs || null,
    elapsed !== '—' ? elapsed : null,
    rows,
    item.hasLimit ? 'LIMIT' : null,
    item.message && err ? item.message : null,
  ].filter(Boolean);

  return (
    <HistoryContextMenu ctx={item}>
      <button
        type="button"
        className={cn(
          'w-full text-left px-1 py-1.5 pl-6 hover:bg-accent/80 border-b border-border/40 last:border-0',
          err && 'bg-destructive/5',
        )}
        onClick={() => onOpen(item)}
        title={[item.stmt, ...detailParts].filter(Boolean).join('\n')}
      >
        <div className="flex items-start gap-1.5 min-w-0">
          <span
            className={cn(
              'shrink-0 mt-0.5 rounded px-1 py-px text-[10px] font-mono font-semibold leading-tight',
              err
                ? 'bg-destructive/15 text-destructive'
                : verb === 'SELECT'
                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                  : verb === 'INSERT' ||
                      verb === 'UPDATE' ||
                      verb === 'DELETE'
                    ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    : 'bg-muted text-muted-foreground',
            )}
          >
            {verb.slice(0, 6)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-xs leading-snug">
              {summary}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
              {when ? <span title={abs}>{when}</span> : null}
              {elapsed !== '—' ? (
                <span className="font-mono tabular-nums">{elapsed}</span>
              ) : (
                <span className="italic opacity-70">pending</span>
              )}
              {rows ? <span className="font-mono tabular-nums">{rows}</span> : null}
              {err && item.message ? (
                <span className="truncate text-destructive max-w-[12rem]">
                  {item.message}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </button>
    </HistoryContextMenu>
  );
}

function ConnectionGroup({
  dbId,
  items,
  expanded,
  onToggle,
  onOpen,
}: {
  dbId: string;
  items: QueryHistoryItem[];
  expanded: boolean;
  onToggle: () => void;
  onOpen: (item: QueryHistoryItem) => void;
}) {
  const name = connectionLabel(dbId);
  const dialect = connectionDialect(dbId);

  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        type="button"
        className="flex w-full items-center gap-1 h-7 px-1 hover:bg-accent/60 text-left"
        onClick={onToggle}
      >
        <ChevronRight
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-90',
          )}
        />
        <DatabaseIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">
          {name}
        </span>
        {dialect ? (
          <span className="shrink-0 text-[10px] text-muted-foreground font-mono">
            {dialect}
          </span>
        ) : null}
        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </button>
      {expanded
        ? items.map((item) => (
            <HistoryItemRow key={item.id} item={item} onOpen={onOpen} />
          ))
        : null}
    </div>
  );
}

export function History() {
  const { t } = useLingui();
  const [rawItems, setRuns] = useAtom(runsAtom);
  const setDocs = useSetAtom(docsAtom);
  const append = useTabsStore((state) => state.append);
  const active = useTabsStore((state) => state.active);
  const currentId = useTabsStore((state) => state.currentId);
  const tabs = useTabsStore((state) => state.tabs);
  const patch = useTabsStore((state) => state.patch);

  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const items = useMemo(() => {
    return (rawItems ?? [])
      .map((r) => normalizeHistoryItem(r))
      .filter((x): x is QueryHistoryItem => x != null);
  }, [rawItems]);

  const filtered = useMemo(
    () => filterHistory(items, search),
    [items, search],
  );

  const groups = useMemo(
    () => groupHistoryByConnection(filtered),
    [filtered],
  );

  // When searching, expand all groups so matches are visible.
  const searching = search.trim().length > 0;

  const handleOpen = (item: QueryHistoryItem) => {
    const stmt = item.stmt ?? '';
    if (!stmt.trim()) return;
    const current = currentId ? tabs[currentId] : undefined;
    if (current?.type === 'editor') {
      setDocs((prev) => ({ ...prev, [current.id]: stmt }));
      if (item.dbId && current.dbId !== item.dbId) {
        patch(current.id, {
          dbId: item.dbId,
          schema: item.schema,
          tableId: item.tableId,
        });
      }
      active(current.id);
      return;
    }
    const id = nanoid();
    setDocs((prev) => ({ ...prev, [id]: stmt }));
    append({
      id,
      dbId: item.dbId,
      schema: item.schema,
      tableId: item.tableId,
      type: 'editor',
      displayName: summarizeSql(stmt, 40),
    });
    active(id);
  };

  const handleClearAll = () => {
    if (!items.length) return;
    setRuns([]);
  };

  return (
    <Container
      title={t`History`}
      actions={
        items.length > 0 ? (
          <button
            type="button"
            className="p-1 text-muted-foreground hover:text-destructive"
            title={t`Clear all history`}
            onClick={handleClearAll}
          >
            <Trash2Icon className="size-3.5" />
          </button>
        ) : null
      }
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="shrink-0 p-1.5 border-b">
          <div className="relative">
            <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t`Search history…`}
              className="h-7 pl-7 pr-7 text-xs"
            />
            {search ? (
              <button
                type="button"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}
                aria-label={t`Clear search`}
              >
                <XIcon className="size-3.5" />
              </button>
            ) : null}
          </div>
          <div className="mt-1 px-0.5 text-[10px] text-muted-foreground">
            {searching
              ? t`${filtered.length} of ${items.length} runs`
              : t`${items.length} run(s)`}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {groups.length === 0 ? (
            <div className="flex h-24 items-center justify-center px-3 text-center text-xs text-muted-foreground">
              {searching ? t`No matching history` : t`No query history yet`}
            </div>
          ) : (
            groups.map((g) => {
              const expanded = searching || !collapsed[g.dbId];
              return (
                <ConnectionGroup
                  key={g.dbId || '__unknown__'}
                  dbId={g.dbId}
                  items={g.items}
                  expanded={expanded}
                  onToggle={() =>
                    setCollapsed((prev) => ({
                      ...prev,
                      [g.dbId]: !prev[g.dbId],
                    }))
                  }
                  onOpen={handleOpen}
                />
              );
            })
          )}
        </div>
      </div>
    </Container>
  );
}
