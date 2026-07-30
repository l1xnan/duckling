import type { Parser } from '@/ast';
import { findParentNode } from '@/ast/analyze';
import type { Node } from 'web-tree-sitter';

export type SqlStatementSlice = {
  /** Raw slice start in document (UTF-16). */
  start: number;
  /** Raw slice end in document (UTF-16). */
  end: number;
  /** Trimmed executable SQL start. */
  trimmedStart: number;
  /** Trimmed executable SQL end. */
  trimmedEnd: number;
  /** Trimmed SQL text to execute. */
  text: string;
};

type LexState =
  | 'normal'
  | 's_single'
  | 's_double'
  | 's_backtick'
  | 'line_comment'
  | 'block_comment'
  | 'dollar';

function sliceFromIndices(
  sql: string,
  start: number,
  end: number,
): SqlStatementSlice {
  const raw = sql.slice(start, end);
  let trimStart = 0;
  let trimEnd = raw.length;
  while (trimStart < trimEnd && /\s/.test(raw[trimStart])) {
    trimStart += 1;
  }
  while (trimEnd > trimStart) {
    const ch = raw[trimEnd - 1];
    if (ch === ';' || /\s/.test(ch)) {
      trimEnd -= 1;
      continue;
    }
    break;
  }
  const text = raw.slice(trimStart, trimEnd);
  const trimmedStart = start + trimStart;
  const trimmedEnd = start + trimEnd;
  return { start, end, trimmedStart, trimmedEnd, text };
}

function readDollarTag(sql: string, i: number): { tag: string; next: number } | null {
  if (sql[i] !== '$') {
    return null;
  }
  const close = sql.indexOf('$', i + 1);
  if (close <= i) {
    return null;
  }
  return { tag: sql.slice(i, close + 1), next: close + 1 };
}

/** Semicolon-aware split (strings, comments, dollar quotes). */
export function splitSqlBySemicolon(sql: string): SqlStatementSlice[] {
  const ranges: { start: number; end: number }[] = [];
  let stmtStart = 0;
  let state: LexState = 'normal';
  let dollarClose: string | null = null;
  let i = 0;

  while (i < sql.length) {
    const c = sql[i];
    const next = sql[i + 1];

    if (state === 'normal') {
      if (c === '-' && next === '-') {
        state = 'line_comment';
        i += 2;
        continue;
      }
      if (c === '#') {
        state = 'line_comment';
        i += 1;
        continue;
      }
      if (c === '/' && next === '*') {
        state = 'block_comment';
        i += 2;
        continue;
      }
      if (c === "'") {
        state = 's_single';
        i += 1;
        continue;
      }
      if (c === '"') {
        state = 's_double';
        i += 1;
        continue;
      }
      if (c === '`') {
        state = 's_backtick';
        i += 1;
        continue;
      }
      if (c === '$') {
        const tag = readDollarTag(sql, i);
        if (tag) {
          dollarClose = tag.tag;
          state = 'dollar';
          i = tag.next;
          continue;
        }
      }
      if (c === ';') {
        ranges.push({ start: stmtStart, end: i + 1 });
        stmtStart = i + 1;
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    if (state === 'line_comment') {
      if (c === '\n') {
        state = 'normal';
      }
      i += 1;
      continue;
    }

    if (state === 'block_comment') {
      if (c === '*' && next === '/') {
        state = 'normal';
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (state === 's_single') {
      if (c === "'" && next === "'") {
        i += 2;
        continue;
      }
      if (c === "'") {
        state = 'normal';
      }
      i += 1;
      continue;
    }

    if (state === 's_double') {
      if (c === '"' && next === '"') {
        i += 2;
        continue;
      }
      if (c === '"') {
        state = 'normal';
      }
      i += 1;
      continue;
    }

    if (state === 's_backtick') {
      if (c === '`') {
        state = 'normal';
      }
      i += 1;
      continue;
    }

    if (state === 'dollar' && dollarClose) {
      if (c === '$' && sql.startsWith(dollarClose, i)) {
        i += dollarClose.length;
        state = 'normal';
        dollarClose = null;
        continue;
      }
      i += 1;
      continue;
    }

    i += 1;
  }

  ranges.push({ start: stmtStart, end: sql.length });

  return ranges
    .map(({ start, end }) => sliceFromIndices(sql, start, end))
    .filter((s) => s.text.length > 0);
}

function collectTopStatements(root: Node): Node[] {
  const direct = root.namedChildren.filter((c) => c.type === 'statement');
  if (direct.length > 0) {
    return direct;
  }
  for (const child of root.namedChildren) {
    const stmts = child.namedChildren.filter((c) => c.type === 'statement');
    if (stmts.length > 0) {
      return stmts;
    }
  }
  return root
    .descendantsOfType('statement')
    .filter((n) => {
      const p = n.parent;
      return p && (p.type === 'source_file' || p.type === 'program' || p.id === root.id);
    });
}

function splitViaTreeSitter(parser: Parser, sql: string): SqlStatementSlice[] {
  const tree = parser.parse(sql);
  if (!tree) {
    return [];
  }
  const nodes = collectTopStatements(tree.rootNode);
  if (nodes.length === 0) {
    return [];
  }
  return nodes
    .map((n) => sliceFromIndices(sql, n.startIndex, n.endIndex))
    .filter((s) => s.text.length > 0);
}

function findViaTreeSitter(
  parser: Parser,
  sql: string,
  offset: number,
): SqlStatementSlice | undefined {
  const tree = parser.parse(sql);
  if (!tree) {
    return undefined;
  }
  const leaf = tree.rootNode.descendantForIndex(offset, offset);
  const stmtNode = findParentNode(leaf, 'statement');
  if (!stmtNode?.text.trim()) {
    return undefined;
  }
  const slice = sliceFromIndices(sql, stmtNode.startIndex, stmtNode.endIndex);
  return slice.text ? slice : undefined;
}

function findStatementInSplits(
  slices: SqlStatementSlice[],
  offset: number,
): SqlStatementSlice | undefined {
  const nonEmpty = slices.filter((s) => s.text.length > 0);
  if (nonEmpty.length === 0) {
    return undefined;
  }

  for (const s of nonEmpty) {
    if (offset >= s.trimmedStart && offset <= s.trimmedEnd) {
      return s;
    }
  }

  let prev: SqlStatementSlice | undefined;
  for (const s of nonEmpty) {
    if (s.trimmedEnd < offset) {
      prev = s;
      continue;
    }
    if (s.trimmedStart > offset) {
      return prev ?? s;
    }
  }
  return prev ?? nonEmpty[nonEmpty.length - 1];
}

/** List all statements — tree-sitter when parser given, else semicolon lexer. */
export function splitSqlStatements(
  sql: string,
  parser?: Parser,
): SqlStatementSlice[] {
  if (parser) {
    const ts = splitViaTreeSitter(parser, sql);
    if (ts.length > 0) {
      return ts;
    }
  }
  return splitSqlBySemicolon(sql);
}

function preferLexerWhenWider(
  offset: number,
  treeSlice: SqlStatementSlice | undefined,
  lexerSlice: SqlStatementSlice | undefined,
): SqlStatementSlice | undefined {
  if (!lexerSlice?.text) {
    return treeSlice;
  }
  if (!treeSlice?.text) {
    return lexerSlice;
  }
  const offsetInLexer =
    offset >= lexerSlice.trimmedStart && offset <= lexerSlice.trimmedEnd;
  if (!offsetInLexer) {
    return treeSlice;
  }
  const treeTrim = treeSlice.text.trim();
  if (
    lexerSlice.text.length > treeSlice.text.length ||
    lexerSlice.text.includes(treeTrim)
  ) {
    return lexerSlice;
  }
  return treeSlice;
}

/** Statement at cursor offset — tree-sitter first, semicolon lexer fallback. */
export function findStatementAtOffset(
  sql: string,
  offset: number,
  parser?: Parser,
): SqlStatementSlice | undefined {
  if (!sql.trim()) {
    return undefined;
  }
  const clamped = Math.max(0, Math.min(offset, sql.length));
  const lexerSlice = findStatementInSplits(splitSqlBySemicolon(sql), clamped);

  if (parser) {
    const treeSlice = findViaTreeSitter(parser, sql, clamped);
    return preferLexerWhenWider(clamped, treeSlice, lexerSlice);
  }

  return lexerSlice;
}

export function statementSliceToSourceRange(
  model: {
    getPositionAt: (offset: number) => {
      lineNumber: number;
      column: number;
    };
  },
  slice: SqlStatementSlice,
): {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
} {
  const start = model.getPositionAt(slice.trimmedStart);
  const end = model.getPositionAt(slice.trimmedEnd);
  return {
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  };
}

/** Block bounds: union of trimmed line extents (not full editor width). */
export function statementHighlightBounds(
  model: {
    getLineContent: (lineNumber: number) => string;
    getPositionAt: (offset: number) => {
      lineNumber: number;
      column: number;
    };
  },
  slice: SqlStatementSlice,
): {
  startLineNumber: number;
  endLineNumber: number;
  startColumn: number;
  endColumn: number;
} {
  const range = statementSliceToSourceRange(model, slice);
  let minCol = range.startColumn;
  let maxCol = range.endColumn;
  for (
    let line = range.startLineNumber;
    line <= range.endLineNumber;
    line += 1
  ) {
    const content = model.getLineContent(line);
    const trimmed = content.trim();
    if (!trimmed) {
      continue;
    }
    const lineStart = content.length - content.trimStart().length + 1;
    const lineEnd = content.trimEnd().length + 1;
    minCol = Math.min(minCol, lineStart);
    maxCol = Math.max(maxCol, lineEnd);
  }
  return {
    startLineNumber: range.startLineNumber,
    endLineNumber: range.endLineNumber,
    startColumn: minCol,
    endColumn: maxCol,
  };
}
