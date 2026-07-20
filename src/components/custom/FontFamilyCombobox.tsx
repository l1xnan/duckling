import { useLingui } from '@lingui/react/macro';
import { useCallback, useMemo, useRef, useState } from 'react';

import { listSystemFonts } from '@/api';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from '@/components/custom/ui/combobox';
import { FormControl } from '@/components/custom/ui/form';
import { cn } from '@/lib/utils';

const FALLBACK_FONTS = [
  'Consolas',
  'Cascadia Code',
  'Cascadia Mono',
  'Courier New',
  'Menlo',
  'Monaco',
  'SF Mono',
  'Segoe UI',
  'Microsoft YaHei',
  'PingFang SC',
  'Hiragino Sans GB',
  'Source Han Sans SC',
  'Noto Sans SC',
  'Arial',
  'Helvetica',
  'system-ui',
  'sans-serif',
  'monospace',
];

type FontItem = {
  label: string;
  value: string;
  /** True when the value is a manually typed name not found in system fonts. */
  isCustom?: boolean;
};

function toFontItems(families: string[], current?: string): FontItem[] {
  const set = new Set<string>();
  for (const family of families) {
    const trimmed = family.trim();
    if (trimmed) set.add(trimmed);
  }
  if (current?.trim()) {
    set.add(current.trim());
  }
  return [...set]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((family) => ({ label: family, value: family }));
}

function hasExactFamily(families: FontItem[], name: string) {
  const target = name.trim().toLowerCase();
  return families.some((item) => item.value.trim().toLowerCase() === target);
}

type FontFamilyComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function FontFamilyCombobox({
  value,
  onChange,
  placeholder,
}: FontFamilyComboboxProps) {
  const { t } = useLingui();
  const [fonts, setFonts] = useState<string[]>(FALLBACK_FONTS);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const loadedRef = useRef(false);
  const loadingRef = useRef(false);

  const resolvedPlaceholder = placeholder ?? t`Select a font`;

  const loadFonts = useCallback(async () => {
    if (loadedRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const listed = await listSystemFonts();
      if (listed.length > 0) {
        setFonts(listed);
      }
      loadedRef.current = true;
    } catch (error) {
      console.warn('Failed to list system fonts:', error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  const items = useMemo(() => {
    const base = toFontItems(fonts, value);
    const q = query.trim();
    if (!q || hasExactFamily(base, q)) {
      return base;
    }
    // Allow committing any typed name / CSS stack even if not installed.
    return [{ label: q, value: q, isCustom: true }, ...base];
  }, [fonts, value, query]);

  const selected =
    items.find((item) => item.value === value && !item.isCustom) ??
    (value
      ? {
          label: value,
          value,
          isCustom: !hasExactFamily(toFontItems(fonts), value),
        }
      : null);

  return (
    <Combobox
      value={selected}
      onValueChange={(item) => {
        if (item?.value) onChange(item.value);
      }}
      items={items}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      onInputValueChange={(next) => setQuery(next)}
      onOpenChange={(open) => {
        if (open) {
          void loadFonts();
          setQuery('');
          return;
        }
        setQuery('');
      }}
    >
      <FormControl>
        <ComboboxTrigger
          className={cn(
            'flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'dark:bg-input/30 dark:hover:bg-input/50',
            'data-placeholder:text-muted-foreground',
          )}
        >
          <ComboboxValue placeholder={resolvedPlaceholder}>
            {(item: FontItem | null) =>
              item ? (
                <span
                  className="min-w-0 flex-1 truncate text-left"
                  style={{ fontFamily: item.value }}
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : null
            }
          </ComboboxValue>
        </ComboboxTrigger>
      </FormControl>
      <ComboboxContent className="max-h-72">
        <ComboboxInput
          placeholder={
            loading ? t`Loading fonts...` : t`Search or type a font name...`
          }
          showTrigger={false}
          className="w-auto"
        />
        <ComboboxEmpty>
          {loading ? t`Loading fonts...` : t`No matching fonts`}
        </ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem
              key={`${item.isCustom ? 'custom:' : ''}${item.value}`}
              value={item}
            >
              {item.isCustom ? (
                <span className="truncate text-muted-foreground" title={item.value}>
                  {t`Use "${item.value}"`}
                </span>
              ) : (
                <span
                  className="truncate"
                  style={{ fontFamily: item.value }}
                  title={item.label}
                >
                  {item.label}
                </span>
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
