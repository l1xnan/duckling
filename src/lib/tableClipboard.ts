/**
 * Clipboard serializers for the result grid (VTable).
 *
 * Pure: the caller maps VTable `CellInfo` into a `ClipboardSelection`.
 * No clipboard I/O here — `CanvasTable` owns `writeText`.
 */

export type CopyFormat =
  | 'markdown'
  | 'html'
  | 'json'
  | 'csv-header'
  | 'csv-no-header'
  | 'tsv';

/**
 * One display cell, mirroring the VTable `CellInfo` fields we rely on:
 * - `value`    → `CellInfo.dataValue` (unformatted origin value)
 * - `title`    → `CellInfo.title` (column definition title)
 * - `field`    → `CellInfo.field` (header field key)
 */
export type ClipboardCell = {
  row: number;
  col: number;
  value?: unknown;
  title?: unknown;
  field?: unknown;
};

export type ClipboardSelection = {
  /** VTable `table.transpose`. */
  transpose?: boolean;
  /** Row-major selected cells (as returned by `getSelectedCellInfos`). */
  cells: ClipboardCell[][];
};

export type ClipboardTable = {
  columns: string[];
  /** Selected values, one array per row. */
  values: unknown[][];
  /** A header row / field column was part of the selection. */
  headerSelected: boolean;
};

/** Escape a value for CSV/TSV (RFC 4180). */
export function escapeDelimited(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || /[\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/**
 * Serialize to a delimited text table.
 * - `delimiter`: `,` for CSV, `\t` for TSV.
 * - `includeHeader`: prepend the column names (`force` ignores the selection).
 */
export function serializeDelimited(
  table: ClipboardTable,
  options: { delimiter?: string; includeHeader: boolean | 'force' } = { includeHeader: 'force' },
): string {
  const delimiter = options.delimiter ?? ',';
  const lines: string[] = [];
  const withHeader = options.includeHeader === 'force' || options.includeHeader;
  if (withHeader && table.columns.length > 0) {
    lines.push(table.columns.map((c) => escapeDelimited(c, delimiter)).join(delimiter));
  }
  for (const row of table.values) {
    lines.push(row.map((c) => escapeDelimited(toText(c), delimiter)).join(delimiter));
  }
  return lines.join('\n');
}

function escapeMarkdown(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');
}

/** GitHub-flavored Markdown table (always includes the header row). */
export function serializeMarkdown(table: ClipboardTable): string {
  const columns = table.columns.map(escapeMarkdown);
  const lines = [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
  ];
  for (const row of table.values) {
    lines.push(`| ${row.map((c) => escapeMarkdown(toText(c))).join(' | ')} |`);
  }
  return lines.join('\n');
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** HTML `<table>` — pastes into docs, wikis and rich-text editors as a real table. */
export function serializeHtml(table: ClipboardTable): string {
  const lines: string[] = ['<table>'];
  if (table.columns.length > 0) {
    lines.push('  <thead>');
    lines.push('    <tr>');
    for (const column of table.columns) {
      lines.push(`      <th>${escapeHtml(column)}</th>`);
    }
    lines.push('    </tr>');
    lines.push('  </thead>');
  }
  lines.push('  <tbody>');
  for (const row of table.values) {
    lines.push('    <tr>');
    for (const cell of row) {
      lines.push(`      <td>${escapeHtml(toText(cell))}</td>`);
    }
    lines.push('    </tr>');
  }
  lines.push('  </tbody>');
  lines.push('</table>');
  return lines.join('\n');
}

function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name} (${count + 1})`;
  });
}

/**
 * JSON array of row objects keyed by column name (pretty-printed, 2 spaces).
 * `null`/`undefined` become `null`; every other value keeps its text form so a
 * mixed-type column never turns into a surprising number.
 */
export function serializeJson(table: ClipboardTable): string {
  const payload = table.values.map((row) => {
    const out: Record<string, string | null> = {};
    row.forEach((cell, index) => {
      out[table.columns[index] ?? `col${index + 1}`] = toJsonValue(cell);
    });
    return out;
  });
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return '[]';
  }
}

/** Raw value → text form, `null`/`undefined` → `''`. */
function toText(value: unknown): string {
  return value == null ? '' : stringifyValue(value);
}

/** Raw value → JSON-safe form, keeping `null` distinguishable from `''`. */
function toJsonValue(value: unknown): string | null {
  return value == null ? null : stringifyValue(value);
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  try {
    const json = JSON.stringify(value);
    if (json !== undefined) {
      return json;
    }
  } catch {
    // Fall through to String() for circular / exotic values.
  }
  return String(value);
}

/** Column title or field key of a cell, `''` when neither is present. */
function readableName(cell: ClipboardCell | undefined): string {
  if (!cell) {
    return '';
  }
  return toText(cell.title) || toText(cell.field);
}

/** Value of a transposed label cell, i.e. the original column it names. */
function transposeLabel(cell: ClipboardCell | undefined): string {
  if (!cell) {
    return '';
  }
  return toText(cell.value) || readableName(cell);
}

/**
 * Map a VTable selection into a header-complete table.
 *
 * Normal mode maps the display grid straight through: the header row supplies
 * the column titles (falling back to `field`, then to the column position).
 *
 * Transpose mirrors the grid, so it is transposed back into a regular table:
 * every display row is one original column, named after its label cell.
 */
export function buildClipboardTable(selection: ClipboardSelection): ClipboardTable {
  const { cells, transpose } = selection;
  const flat = cells.flat();
  if (flat.length === 0) {
    return { columns: [], values: [], headerSelected: false };
  }

  // The header is display row 0 — the column titles normally, the original row
  // labels when transposed.
  const headerSelected = flat.some((cell) => cell.row === 0);
  const bodyRows = headerSelected ? cells.slice(1) : cells;
  if (bodyRows.length === 0) {
    return { columns: [], values: [], headerSelected };
  }

  const minCol = Math.min(...flat.map((cell) => cell.col));

  if (transpose === true) {
    const columns = bodyRows.map((row, index) => {
      const label = transposeLabel(row[0]);
      return label || `col${minCol + index + 1}`;
    });
    const values = bodyRows.map((row) =>
      row.slice(1).map((cell) => cell.value ?? null),
    );
    return { columns: uniqueNames(columns), values, headerSelected };
  }

  const width = Math.max(...bodyRows.map((row) => row.length), cells[0]?.length ?? 0);

  const columns: string[] = [];
  for (let index = 0; index < width; index += 1) {
    const headerCell = cells[0]?.[index];
    const bodyCell = bodyRows[0]?.[index];
    const name = readableName(headerCell) || readableName(bodyCell);
    columns.push(name || `col${bodyCell?.col ?? minCol + index}`);
  }

  const values = bodyRows.map((row) => {
    const out: unknown[] = [];
    for (let index = 0; index < width; index += 1) {
      out.push(row[index]?.value ?? null);
    }
    return out;
  });

  return { columns: uniqueNames(columns), values, headerSelected };
}

export type CopyPlan =
  | { format: 'markdown'; text: string; rowCount: number }
  | { format: 'html'; text: string; rowCount: number }
  | { format: 'json'; text: string; rowCount: number }
  | { format: 'csv-header'; text: string; rowCount: number }
  | { format: 'csv-no-header'; text: string; rowCount: number }
  | { format: 'tsv'; text: string; rowCount: number };

/** Build the clipboard text for a format. Returns `null` for an empty selection. */
export function planCopy(
  selection: ClipboardSelection,
  format: CopyFormat,
): CopyPlan | null {
  if (!selection.cells?.length) {
    return null;
  }
  const table = buildClipboardTable(selection);
  const rowCount = table.values.length;
  switch (format) {
    case 'markdown':
      return { format, text: serializeMarkdown(table), rowCount };
    case 'html':
      return { format, text: serializeHtml(table), rowCount };
    case 'json':
      return { format, text: serializeJson(table), rowCount };
    case 'csv-header':
      return {
        format,
        text: serializeDelimited(table, { delimiter: ',', includeHeader: 'force' }),
        rowCount,
      };
    case 'csv-no-header':
      return {
        format,
        text: serializeDelimited(table, { delimiter: ',', includeHeader: false }),
        rowCount,
      };
    case 'tsv':
      return {
        format,
        text: serializeDelimited(table, { delimiter: '\t', includeHeader: 'force' }),
        rowCount,
      };
    default:
      return null;
  }
}
