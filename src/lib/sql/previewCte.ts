import { findParentNode } from '@/ast/analyze';
import type { Node } from 'web-tree-sitter';

export type CtePreview = {
  sql: string;
  cteName: string;
};

type ParseTree = {
  rootNode: Node;
};

type SqlParser = {
  parse: (input: string) => ParseTree | null;
};

const UNQUOTED_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** A single SQL identifier (optional surrounding space; no newlines or commas). */
export function isSingleSqlIdentifier(text: string): boolean {
  if (/[\r\n,]/.test(text)) {
    return false;
  }
  const t = text.trim();
  if (!t || /\s/.test(t)) {
    return false;
  }
  if (UNQUOTED_IDENT.test(t)) {
    return true;
  }
  if (t.length >= 3 && t.startsWith('"') && t.endsWith('"')) {
    return true;
  }
  if (t.length >= 3 && t.startsWith('`') && t.endsWith('`')) {
    return true;
  }
  return false;
}

function identKey(name: string): string {
  const t = name.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith('`') && t.endsWith('`'))
  ) {
    return t.slice(1, -1);
  }
  return t.toLowerCase();
}

function namesEqual(a: string, b: string): boolean {
  return identKey(a) === identKey(b);
}

function findSelfOrParent(start: Node | null, type: string): Node | null {
  let current = start;
  while (current) {
    if (current.type === type) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function identifierAt(root: Node, offset: number): Node | null {
  const covering = (idx: number): Node | null => {
    const leaf = root.descendantForIndex(idx, idx);
    const ident = findSelfOrParent(leaf, 'identifier');
    if (!ident) {
      return null;
    }
    if (idx >= ident.startIndex && idx <= ident.endIndex) {
      return ident;
    }
    return null;
  };
  return covering(offset) ?? (offset > 0 ? covering(offset - 1) : null);
}

function cteNameIdentifier(cte: Node): Node | null {
  for (const child of cte.namedChildren) {
    if (child?.type === 'identifier') {
      return child;
    }
  }
  return null;
}

function directCtes(stmt: Node): Node[] {
  return stmt.namedChildren.filter((c) => c?.type === 'cte');
}

function findCteInEnclosingStatements(
  startStmt: Node,
  candidate: string,
): { stmt: Node; cte: Node; nameNode: Node } | null {
  let stmt: Node | null = startStmt;
  while (stmt) {
    for (const cte of directCtes(stmt)) {
      const nameNode = cteNameIdentifier(cte);
      if (nameNode && namesEqual(nameNode.text, candidate)) {
        return { stmt, cte, nameNode };
      }
    }
    stmt = findParentNode(stmt, 'statement');
  }
  return null;
}

/**
 * Rewrite a WITH query so it ends at `candidate` and selects from that CTE.
 * `selectedText` set: only when it is a single identifier matching a CTE.
 * `selectedText` unset: only when the cursor sits on an identifier matching a CTE.
 */
export function resolveCtePreview(
  sql: string,
  offset: number,
  selectedText: string | undefined,
  parser: SqlParser | undefined,
): CtePreview | null {
  if (!parser || !sql.trim()) {
    return null;
  }

  const tree = parser.parse(sql);
  const root = tree?.rootNode;
  if (!root) {
    return null;
  }

  const clamped = Math.max(0, Math.min(offset, sql.length));
  let candidate: string | undefined;

  if (selectedText != null && selectedText.length > 0) {
    if (!isSingleSqlIdentifier(selectedText)) {
      return null;
    }
    candidate = selectedText.trim();
  } else {
    const ident = identifierAt(root, clamped);
    if (!ident?.text) {
      return null;
    }
    candidate = ident.text;
  }

  const leaf = root.descendantForIndex(clamped, clamped);
  const stmt =
    findSelfOrParent(leaf, 'statement') ?? findParentNode(leaf, 'statement');
  if (!stmt) {
    return null;
  }

  const hit = findCteInEnclosingStatements(stmt, candidate);
  if (!hit) {
    return null;
  }

  const head = sql
    .slice(hit.stmt.startIndex, hit.cte.endIndex)
    .replace(/\s+$/, '');
  if (!head) {
    return null;
  }

  const cteName = hit.nameNode.text;
  return {
    sql: `${head}\nSELECT * FROM ${cteName}`,
    cteName,
  };
}