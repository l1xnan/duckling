import { useEffect, useMemo, useState } from 'react';

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
} from '@/components/ui/combobox';
import { FormControl } from '@/components/ui/form';
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

type FontItem = { label: string; value: string };

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

export function useSystemFontFamilies() {
  const [fonts, setFonts] = useState<string[]>(FALLBACK_FONTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const listed = await listSystemFonts();
        if (!cancelled && listed.length > 0) {
          setFonts(listed);
        }
      } catch (error) {
        console.warn('Failed to list system fonts:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { fonts, loading };
}

type FontFamilyComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  fonts: string[];
};

export function FontFamilyCombobox({
  value,
  onChange,
  placeholder = 'Select a font',
  fonts,
}: FontFamilyComboboxProps) {
  const items = useMemo(() => toFontItems(fonts, value), [fonts, value]);

  const selected =
    items.find((item) => item.value === value) ?? (value ? { label: value, value } : null);

  return (
    <Combobox
      value={selected}
      onValueChange={(item) => {
        if (item?.value) onChange(item.value);
      }}
      items={items}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
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
          <ComboboxValue placeholder={placeholder}>
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
        {/* Searchable select: Input lives inside the popup. */}
        <ComboboxInput placeholder="Search fonts..." showTrigger={false} className="w-auto" />
        <ComboboxEmpty>No matching fonts</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value} value={item}>
              <span className="truncate" style={{ fontFamily: item.value }} title={item.label}>
                {item.label}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
