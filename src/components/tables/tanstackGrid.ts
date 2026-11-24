export type ColumnPinningState = {
  start: string[];
  end: string[];
};

const SERIES_ID = '#';

/** Pin the row-number column first, then the user's left pins, then right pins. */
export function columnPinningFor(
  left: string[],
  right: string[],
  seriesId = SERIES_ID,
): ColumnPinningState {
  const start = [seriesId];
  for (const id of left) {
    if (id !== seriesId && !start.includes(id)) start.push(id);
  }
  const end = right.filter((id) => id !== seriesId && !start.includes(id));
  return { start, end };
}

export type TransposeRow = Record<string, unknown> & { __field: string };

/** One row per field, one column (`r0`, `r1`, …) per source record. */
export function transposeRecords(
  fieldNames: string[],
  records: Record<string, unknown>[],
): TransposeRow[] {
  return fieldNames.map((name) => {
    const row: TransposeRow = { __field: name };
    for (let index = 0; index < records.length; index += 1) {
      row[`r${index}`] = records[index]?.[name];
    }
    return row;
  });
}

export function selectionBounds(
  anchor: { row: number; col: number },
  focus: { row: number; col: number },
) {
  return {
    r0: Math.min(anchor.row, focus.row),
    c0: Math.min(anchor.col, focus.col),
    r1: Math.max(anchor.row, focus.row),
    c1: Math.max(anchor.col, focus.col),
  };
}

/** Cap a guessed column width the same way the canvas grid caps auto width. */
export function estimateColumnWidth(samples: string[], fontSize: number): number {
  let longest = 0;
  for (const sample of samples) {
    longest = Math.max(longest, sample.length);
  }
  return Math.min(200, Math.max(72, Math.ceil(longest * fontSize * 0.62 + 20)));
}
