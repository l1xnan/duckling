import { describe, expect, it } from 'vitest';

import {
  buildClipboardTable,
  escapeDelimited,
  escapeHtml,
  planCopy,
  serializeDelimited,
  serializeHtml,
  serializeJson,
  serializeMarkdown,
  type ClipboardCell,
  type ClipboardSelection,
  type CopyFormat,
} from '@/lib/tableClipboard';

/** Mirrors the VTable `CellInfo` fields the serializers consume. */
const cell = (
  row: number,
  col: number,
  value: unknown,
  extra: Partial<Pick<ClipboardCell, 'title' | 'field'>> = {},
): ClipboardCell => ({ row, col, value, ...extra });

/** Header row 0 (titles `id` / `name`) plus two data rows. */
function normalSelection(includeHeader = true): ClipboardSelection {
  const header = [
    cell(0, 0, 'id', { title: 'id', field: 'id' }),
    cell(0, 1, 'name', { title: 'name', field: 'name' }),
  ];
  const rows = [
    [cell(2, 0, 1, { title: 'id', field: 'id' }), cell(2, 1, 'a,b', { title: 'name', field: 'name' })],
    [
      cell(3, 0, 2, { title: 'id', field: 'id' }),
      cell(3, 1, 'say "hi"', { title: 'name', field: 'name' }),
    ],
  ];
  return { cells: includeHeader ? [header, ...rows] : rows };
}

/**
 * Transposed grid: col 0 is the label column (original column names, one per
 * row), row 0 holds the original row-index labels. Value cells carry no field
 * of their own — that is how VTable reports them.
 */
function transposeSelection(includeHeader = true): ClipboardSelection {
  const header = [
    cell(0, 0, undefined, { field: '__index__' }),
    cell(0, 1, 'ann', { field: 'id' }),
    cell(0, 2, 'bob', { field: 'name' }),
  ];
  const rows = [
    [
      cell(2, 0, 'id', { title: 'id', field: '__index__' }),
      cell(2, 1, 1),
      cell(2, 2, 2),
    ],
    [
      cell(3, 0, 'name', { title: 'name', field: '__index__' }),
      cell(3, 1, 'ann'),
      cell(3, 2, 'bob'),
    ],
  ];
  // A body-only selection starts below the transposed header row.
  return includeHeader
    ? { transpose: true, cells: [[...header], ...rows] }
    : { transpose: true, cells: rows };
}
describe('buildClipboardTable', () => {
  it('drops the header row and keeps column names', () => {
    const table = buildClipboardTable(normalSelection());
    expect(table.headerSelected).toBe(true);
    expect(table.columns).toEqual(['id', 'name']);
    expect(table.values).toEqual([
      [1, 'a,b'],
      [2, 'say "hi"'],
    ]);
  });

  it('recovers column names from body cells when the header is not selected', () => {
    const table = buildClipboardTable(normalSelection(false));
    expect(table.headerSelected).toBe(false);
    expect(table.columns).toEqual(['id', 'name']);
    expect(table.values).toHaveLength(2);
  });

  it('falls back to the display column position when no name is known', () => {
    const table = buildClipboardTable({
      cells: [[cell(1, 0, 'x'), cell(1, 1, 'y')]],
    });
    expect(table.columns).toEqual(['col0', 'col1']);
  });

  it('keeps null distinct from an empty string', () => {
    const table = buildClipboardTable({
      cells: [[cell(1, 0, null), cell(1, 1, undefined), cell(1, 2, '')]],
    });
    expect(table.values[0]).toEqual([null, null, '']);
  });

  it('de-duplicates repeated column names', () => {
    const table = buildClipboardTable({
      cells: [
        [
          cell(1, 0, '1', { field: 'a' }),
          cell(1, 1, '2', { field: 'a' }),
          cell(1, 2, '3', { field: 'a' }),
        ],
      ],
    });
    expect(table.columns).toEqual(['a', 'a (2)', 'a (3)']);
  });

  it('handles an empty selection', () => {
    expect(buildClipboardTable({ cells: [] })).toEqual({
      columns: [],
      values: [],
      headerSelected: false,
    });
  });

  it('treats a header-only selection as having no rows', () => {
    const table = buildClipboardTable({
      cells: [[cell(0, 0, 'id', { title: 'id', field: 'id' })]],
    });
    expect(table.values).toEqual([]);
  });

  it('transpose: re-transposes into one column per original field', () => {
    const table = buildClipboardTable(transposeSelection());
    expect(table.headerSelected).toBe(true);
    expect(table.columns).toEqual(['id', 'name']);
    expect(table.values).toEqual([
      [1, 2],
      ['ann', 'bob'],
    ]);
  });

  it('transpose without the header row behaves the same', () => {
    const table = buildClipboardTable(transposeSelection(false));
    expect(table.headerSelected).toBe(false);
    expect(table.columns).toEqual(['id', 'name']);
    expect(table.values).toEqual([
      [1, 2],
      ['ann', 'bob'],
    ]);
  });
});

describe('serializeDelimited', () => {
  const table = buildClipboardTable(normalSelection());

  it('quotes values containing the delimiter, quotes or newlines', () => {
    expect(escapeDelimited('a,b', ',')).toBe('"a,b"');
    expect(escapeDelimited('say "hi"', ',')).toBe('"say ""hi"""');
    expect(escapeDelimited('a\nb', ',')).toBe('"a\nb"');
    expect(escapeDelimited('plain', ',')).toBe('plain');
  });

  it('forces a header row', () => {
    expect(serializeDelimited(table, { includeHeader: 'force' })).toBe(
      ['id,name', '1,"a,b"', '2,"say ""hi"""'].join('\n'),
    );
  });

  it('omits the header row when asked', () => {
    expect(serializeDelimited(table, { includeHeader: false })).toBe(
      ['1,"a,b"', '2,"say ""hi"""'].join('\n'),
    );
  });

  it('supports a tab delimiter', () => {
    expect(serializeDelimited(table, { delimiter: '\t', includeHeader: true })).toBe(
      ['id\tname', '1\ta,b', '2\t"say ""hi"""'].join('\n'),
    );
  });
});

describe('serializeMarkdown', () => {
  it('always emits a header and separator row and escapes pipes', () => {
    const table = buildClipboardTable({
      cells: [[cell(1, 0, 'a|b', { field: 'v' })]],
    });
    expect(serializeMarkdown(table)).toBe(['| v |', '| --- |', '| a\\|b |'].join('\n'));
  });

  it('escapes newlines as <br>', () => {
    const table = buildClipboardTable({
      cells: [[cell(1, 0, 'a\nb', { field: 'v' })]],
    });
    expect(serializeMarkdown(table)).toBe(['| v |', '| --- |', '| a<br>b |'].join('\n'));
  });
});

describe('serializeHtml', () => {
  it('escapes markup and produces a real table', () => {
    const table = buildClipboardTable({
      cells: [[cell(1, 0, '<b>&"', { field: 'v' })]],
    });
    const html = serializeHtml(table);
    expect(escapeHtml('<b>&"')).toBe('&lt;b&gt;&amp;&quot;');
    expect(html).toContain('<th>v</th>');
    expect(html).toContain('<td>&lt;b&gt;&amp;&quot;</td>');
    expect(html.startsWith('<table>')).toBe(true);
  });
});

describe('serializeJson', () => {
  it('emits an array of row objects', () => {
    const table = buildClipboardTable(normalSelection());
    expect(JSON.parse(serializeJson(table))).toEqual([
      { id: '1', name: 'a,b' },
      { id: '2', name: 'say "hi"' },
    ]);
  });

  it('keeps null as null and preserves boolean / number text', () => {
    const table = buildClipboardTable({
      cells: [
        [
          cell(1, 0, 1, { field: 'n' }),
          cell(1, 1, true, { field: 'b' }),
          cell(1, 2, null, { field: 'z' }),
        ],
      ],
    });
    expect(serializeJson(table)).toBe(
      JSON.stringify([{ n: '1', b: 'true', z: null }], null, 2),
    );
  });
});

/** Guard against a menu key that no longer maps to a `CopyFormat`. */
const FORMAT_KEYS: CopyFormat[] = [
  'markdown',
  'html',
  'json',
  'csv-header',
  'csv-no-header',
  'tsv',
];

describe('planCopy', () => {
  it('handles every declared format', () => {
    for (const format of FORMAT_KEYS) {
      expect(planCopy(normalSelection(), format)?.format).toBe(format);
    }
  });
  it('returns null for an empty selection', () => {
    expect(planCopy({ cells: [] }, 'markdown')).toBeNull();
  });

  it('reports the copied row count', () => {
    const plan = planCopy(normalSelection(), 'csv-header');
    expect(plan?.rowCount).toBe(2);
    expect(plan?.format).toBe('csv-header');
  });

  it('routes each format to its serializer', () => {
    const selection = normalSelection();
    expect(planCopy(selection, 'markdown')?.text).toContain('| id | name |');
    expect(planCopy(selection, 'html')?.text).toContain('<table>');
    expect(planCopy(selection, 'json')?.text).toContain('"id": "1"');
    expect(planCopy(selection, 'csv-header')?.text.split('\n')[0]).toBe('id,name');
    expect(planCopy(selection, 'csv-no-header')?.text.split('\n')[0]).toBe('1,"a,b"');
    expect(planCopy(selection, 'tsv')?.text.split('\n')[0]).toBe('id\tname');
  });
});
