import { Data, Vector } from '@apache-arrow/ts';

import { arrowToJSON } from '@/api';

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Vector) {
    try {
      return JSON.parse(arrowToJSON(value as unknown as Data, 0));
    } catch {
      return value.toString();
    }
  }
  return value;
}

export function formatRecordAsJson(record: Record<string, unknown>): string {
  try {
    return JSON.stringify(record, jsonReplacer, 2);
  } catch {
    return String(record);
  }
}
