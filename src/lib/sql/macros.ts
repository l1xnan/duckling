/** Short label for a single macro binding (result tab / history). */
export function formatMacroLabel(binding: Record<string, string>): string {
  const entries = Object.entries(binding);
  if (entries.length === 0) {
    return '';
  }
  if (entries.length === 1) {
    return entries[0][1];
  }
  return entries.map(([k, v]) => `${k}=${v}`).join(', ');
}

function needsYamlQuotes(value: string): boolean {
  if (value === '') {
    return true;
  }
  if (/[\n\r:#{}[\],&*!|>'"%@`]/.test(value)) {
    return true;
  }
  if (/^\s|\s$/.test(value)) {
    return true;
  }
  if (/^(true|false|null|yes|no|on|off)$/i.test(value)) {
    return true;
  }
  if (/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(value)) {
    return true;
  }
  return false;
}

function formatYamlScalar(value: string): string {
  if (!needsYamlQuotes(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "''")}'`;
}

function orderedKeys(
  values: Record<string, string[]>,
  keyOrder?: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keyOrder ?? []) {
    if (k in values && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  for (const k of Object.keys(values).sort()) {
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

/** Build a leading block-comment @vars YAML section from name → values. */
export function formatVarsBlock(
  values: Record<string, string[]>,
  keyOrder?: string[],
): string {
  const keys = orderedKeys(values, keyOrder);
  const lines: string[] = ['/*', '@vars'];
  for (const key of keys) {
    const list = values[key] ?? [];
    if (list.length <= 1) {
      lines.push(`${key}: ${formatYamlScalar(list[0] ?? '')}`);
    } else {
      lines.push(`${key}:`);
      for (const item of list) {
        lines.push(`  - ${formatYamlScalar(item)}`);
      }
    }
  }
  lines.push('*/');
  return lines.join('\n');
}

/** Prepend/replace @vars block before template body. */
export function applyVarsToSql(
  templateBody: string,
  values: Record<string, string[]>,
  keyOrder?: string[],
): string {
  const body = templateBody.replace(/^\s+/, '');
  const block = formatVarsBlock(values, keyOrder);
  if (!body) {
    return block;
  }
  return `${block}\n\n${body}`;
}

/** Toolbar scaffold: keep provided values; missing keys become empty string. */
export function buildVarsScaffold(
  placeholders: string[],
  provided: Record<string, string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const name of placeholders) {
    const existing = provided[name];
    if (existing && existing.length > 0) {
      out[name] = [...existing];
    } else {
      out[name] = [''];
    }
  }
  for (const [k, v] of Object.entries(provided)) {
    if (!(k in out) && v.length > 0) {
      out[k] = [...v];
    }
  }
  return out;
}

/** Merge provided @vars with dialog overrides (overrides win). */
export function mergeMacroValues(
  provided: Record<string, string[]>,
  overrides: Record<string, string[]>,
): Record<string, string[]> {
  return { ...provided, ...overrides };
}
