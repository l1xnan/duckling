import { atomStore } from '@/stores';
import { docsAtom } from '@/stores/app';
import { useDBListStore } from '@/stores/dbList';
import {
  type EditorContextType,
  useTabsStore,
} from '@/stores/tabs';

import {
  isScratchPath,
  listScratch,
  normalizePath,
  readScratch,
  resolveScratchDir,
  writeScratch,
} from './scratchSql';

const MIGRATION_FLAG = 'scratchSqlMigratedV1';

/** Doc keys for local SQL files are absolute paths; scratch ids are path-free (nanoid). */
export function isPathLikeDocKey(key: string): boolean {
  if (!key) {
    return false;
  }
  if (key.includes('/') || key.includes('\\')) {
    return true;
  }
  // Windows drive without slash (rare)
  return /^[A-Za-z]:/.test(key);
}

/** Read legacy jotai docs from localStorage (sync, independent of atom hydration). */
export function readLegacyDocsFromLocalStorage(): Record<string, string> {
  try {
    const raw = localStorage.getItem('docs');
    if (raw == null || raw === '') {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function mergeDocs(
  a: Record<string, string>,
  b: Record<string, string>,
): Record<string, string> {
  // Prefer non-empty values; `b` wins on conflict when both non-empty.
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v !== '' || out[k] == null) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Migrate localStorage `docs` scratch entries to `{app_data}/scratch/{id}.sql`
 * and attach `path` on editor tabs.
 *
 * Safe to call multiple times (idempotent for already-path'd tabs / existing files).
 */
export async function migrateScratchSqlFromDocs(): Promise<{
  scratchDir: string;
  migratedTabIds: string[];
  migratedOrphanDocIds: string[];
  rehydratedDiskIds: string[];
}> {
  const scratchDir = await resolveScratchDir();
  const migratedTabIds: string[] = [];
  const migratedOrphanDocIds: string[] = [];
  const rehydratedDiskIds: string[] = [];

  const fromLs = readLegacyDocsFromLocalStorage();
  const fromAtom = (atomStore.get(docsAtom) ?? {}) as Record<string, string>;
  const docsSnap = mergeDocs(fromLs, fromAtom);

  // Ensure atom memory has full legacy snapshot (hydration may lag).
  if (Object.keys(fromLs).length > 0) {
    atomStore.set(docsAtom, (prev) => mergeDocs(fromLs, prev ?? {}));
  }

  const defaultDbId = useDBListStore.getState().dbList[0]?.id ?? '';
  const handled = new Set<string>();

  // 1) Editor tabs without path → write file + patch path
  for (const tab of Object.values(useTabsStore.getState().tabs)) {
    if (tab.type !== 'editor') {
      continue;
    }
    const editor = tab as EditorContextType;
    if (editor.path) {
      if (
        isScratchPath(editor.path, scratchDir) &&
        (docsSnap[editor.id] == null || docsSnap[editor.id] === '')
      ) {
        const body = await readScratch(editor.id);
        if (body) {
          atomStore.set(docsAtom, (prev) =>
            prev[editor.id] != null && prev[editor.id] !== ''
              ? prev
              : { ...prev, [editor.id]: body },
          );
        }
      }
      handled.add(editor.id);
      continue;
    }

    const content = docsSnap[editor.id] ?? '';
    // If file already exists with content and memory is empty, prefer disk
    let body = content;
    if (!body) {
      const existing = await readScratch(editor.id);
      if (existing) {
        body = existing;
        atomStore.set(docsAtom, (prev) => ({
          ...prev,
          [editor.id]: existing,
        }));
      }
    }
    const path = await writeScratch(editor.id, body);
    useTabsStore.getState().patch(editor.id, {
      path,
    } as Partial<EditorContextType>);
    migratedTabIds.push(editor.id);
    handled.add(editor.id);
  }

  // 2) Orphan docs keys (scratch ids still in localStorage, no tab / no path tab)
  for (const [id, content] of Object.entries(docsSnap)) {
    if (handled.has(id) || isPathLikeDocKey(id)) {
      continue;
    }
    // Skip empty orphans (noise)
    if (!content?.trim()) {
      continue;
    }
    const existingTab = useTabsStore.getState().tabs[id] as
      | EditorContextType
      | undefined;
    if (existingTab?.path && isScratchPath(existingTab.path, scratchDir)) {
      // Already on disk path; refresh file from docs if needed
      await writeScratch(id, content);
      handled.add(id);
      continue;
    }

    const path = await writeScratch(id, content);
    if (!existingTab) {
      useTabsStore.setState((s) => {
        if (s.tabs[id]) {
          return s;
        }
        return {
          ...s,
          tabs: {
            ...s.tabs,
            [id]: {
              id,
              dbId: defaultDbId,
              displayName: id.slice(0, 8),
              type: 'editor',
              path,
            } satisfies EditorContextType,
          },
        };
      });
    } else {
      useTabsStore.getState().patch(id, {
        path,
      } as Partial<EditorContextType>);
    }
    migratedOrphanDocIds.push(id);
    handled.add(id);
  }

  // 3) Disk files without tab metadata → rehydrate closed scratch tabs
  const onDisk = await listScratch();
  for (const entry of onDisk) {
    const id = entry.id;
    const latest = useTabsStore.getState().tabs[id] as
      | EditorContextType
      | undefined;
    if (latest) {
      if (!latest.path) {
        useTabsStore.getState().patch(id, {
          path: entry.path,
        } as Partial<EditorContextType>);
      }
      continue;
    }
    const body =
      docsSnap[id] != null && docsSnap[id] !== ''
        ? docsSnap[id]
        : await readScratch(id);
    atomStore.set(docsAtom, (prev) =>
      prev[id] != null ? prev : { ...prev, [id]: body },
    );
    useTabsStore.setState((s) => {
      if (s.tabs[id]) {
        return s;
      }
      return {
        ...s,
        tabs: {
          ...s.tabs,
          [id]: {
            id,
            dbId: defaultDbId,
            displayName: id.slice(0, 8),
            type: 'editor',
            path: normalizePath(entry.path),
          } satisfies EditorContextType,
        },
      };
    });
    rehydratedDiskIds.push(id);
  }

  try {
    localStorage.setItem(MIGRATION_FLAG, '1');
  } catch {
    // ignore quota
  }

  return {
    scratchDir,
    migratedTabIds,
    migratedOrphanDocIds,
    rehydratedDiskIds,
  };
}
