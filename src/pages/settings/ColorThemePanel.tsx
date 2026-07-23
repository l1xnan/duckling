import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MoonIcon,
  RotateCcwIcon,
  SunIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/custom/ui/button';
import { Input } from '@/components/custom/ui/input';
import { Label } from '@/components/custom/ui/label';
import { useResolvedColorTheme } from '@/hooks/use-color-theme';
import {
  defaultSettings,
  setSettings,
  useColorThemeSetting,
} from '@/stores/setting';
import {
  colorThemePresets,
  getEffectiveTokens,
  hasColorOverrides,
  type ColorThemeConfig,
  type ThemeTokens,
} from '@/themes/presets';
import { cn } from '@/lib/utils';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(value: string): string | null {
  const v = value.trim();
  if (!HEX_RE.test(v)) return null;
  if (v.length === 4) {
    const [, r, g, b] = v;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return v.toLowerCase();
}

type TokenGroup = {
  title: MessageDescriptor;
  tokens: { key: keyof ThemeTokens; label: MessageDescriptor }[];
};

const TOKEN_GROUPS: TokenGroup[] = [
  {
    title: msg`Base`,
    tokens: [
      { key: 'background', label: msg`Background` },
      { key: 'foreground', label: msg`Foreground` },
      { key: 'card', label: msg`Card` },
      { key: 'cardForeground', label: msg`Card foreground` },
      { key: 'popover', label: msg`Popover` },
      { key: 'popoverForeground', label: msg`Popover foreground` },
    ],
  },
  {
    title: msg`Primary`,
    tokens: [
      { key: 'primary', label: msg`Primary` },
      { key: 'primaryForeground', label: msg`Primary foreground` },
      { key: 'secondary', label: msg`Secondary` },
      { key: 'secondaryForeground', label: msg`Secondary foreground` },
    ],
  },
  {
    title: msg`Accent & muted`,
    tokens: [
      { key: 'muted', label: msg`Muted` },
      { key: 'mutedForeground', label: msg`Muted foreground` },
      { key: 'accent', label: msg`Accent` },
      { key: 'accentForeground', label: msg`Accent foreground` },
      { key: 'selection', label: msg`Selection` },
    ],
  },
  {
    title: msg`Border & status`,
    tokens: [
      { key: 'border', label: msg`Border` },
      { key: 'input', label: msg`Input` },
      { key: 'ring', label: msg`Ring` },
      { key: 'destructive', label: msg`Destructive` },
      { key: 'destructiveForeground', label: msg`Destructive foreground` },
    ],
  },
  {
    title: msg`Sidebar`,
    tokens: [
      { key: 'sidebarBackground', label: msg`Sidebar background` },
      { key: 'sidebarForeground', label: msg`Sidebar foreground` },
      { key: 'sidebarPrimary', label: msg`Sidebar primary` },
      { key: 'sidebarPrimaryForeground', label: msg`Sidebar primary foreground` },
      { key: 'sidebarAccent', label: msg`Sidebar accent` },
      { key: 'sidebarAccentForeground', label: msg`Sidebar accent foreground` },
      { key: 'sidebarBorder', label: msg`Sidebar border` },
      { key: 'sidebarRing', label: msg`Sidebar ring` },
    ],
  },
  {
    title: msg`Charts`,
    tokens: [
      { key: 'chart1', label: msg`Chart 1` },
      { key: 'chart2', label: msg`Chart 2` },
      { key: 'chart3', label: msg`Chart 3` },
      { key: 'chart4', label: msg`Chart 4` },
      { key: 'chart5', label: msg`Chart 5` },
    ],
  },
];

function writeColorTheme(next: ColorThemeConfig) {
  setSettings((s) => ({
    ...s,
    color_theme: next,
  }));
}

function PresetCard({
  name,
  selected,
  modified,
  light,
  dark,
  onSelect,
}: {
  name: string;
  selected: boolean;
  modified: boolean;
  light: ThemeTokens;
  dark: ThemeTokens;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors',
        'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border',
      )}
    >
      <div className="flex h-10 overflow-hidden rounded-md border border-border/60">
        <div
          className="flex flex-1 items-center justify-center gap-1"
          style={{ background: light.background }}
        >
          <span
            className="size-2.5 rounded-full"
            style={{ background: light.primary }}
          />
          <span
            className="size-2.5 rounded-full"
            style={{ background: light.accent }}
          />
          <span
            className="size-2.5 rounded-full"
            style={{ background: light.destructive }}
          />
        </div>
        <div
          className="flex flex-1 items-center justify-center gap-1"
          style={{ background: dark.background }}
        >
          <span
            className="size-2.5 rounded-full"
            style={{ background: dark.primary }}
          />
          <span
            className="size-2.5 rounded-full"
            style={{ background: dark.accent }}
          />
          <span
            className="size-2.5 rounded-full"
            style={{ background: dark.destructive }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-1 px-0.5">
        <span className="truncate text-xs font-medium">{name}</span>
        {selected && modified ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            <Trans>Custom</Trans>
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ColorRow({
  label,
  value,
  overridden,
  onChange,
  onReset,
}: {
  label: string;
  value: string;
  overridden: boolean;
  onChange: (hex: string) => void;
  onReset: () => void;
}) {
  const displayValue = normalizeHex(value) ?? value;
  const [draft, setDraft] = useState(displayValue);

  useEffect(() => {
    setDraft(displayValue);
  }, [displayValue]);

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={displayValue}
        onChange={(e) => {
          const hex = normalizeHex(e.target.value);
          if (hex) {
            setDraft(hex);
            onChange(hex);
          }
        }}
        className="size-7 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
        aria-label={label}
      />
      <Label className="min-w-0 flex-1 truncate text-xs font-normal">
        {label}
      </Label>
      <Input
        value={draft}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          const hex = normalizeHex(next);
          if (hex) onChange(hex);
        }}
        onBlur={() => {
          const hex = normalizeHex(draft);
          if (hex) {
            setDraft(hex);
            onChange(hex);
          } else {
            setDraft(displayValue);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-7 w-[5.5rem] shrink-0 font-mono text-xs"
        spellCheck={false}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={!overridden}
        onClick={onReset}
        className={cn(!overridden && 'invisible')}
        title="Reset"
      >
        <RotateCcwIcon className="size-3.5" />
      </Button>
    </div>
  );
}

export function ColorThemePanel() {
  const { t } = useLingui();
  const colorTheme = useColorThemeSetting();
  const { mode } = useResolvedColorTheme();
  const [editMode, setEditMode] = useState<'light' | 'dark'>(mode);
  const [customOpen, setCustomOpen] = useState(
    () => hasColorOverrides(colorTheme?.overrides),
  );

  const presetId = colorTheme?.preset ?? defaultSettings.color_theme!.preset;
  const modified = hasColorOverrides(colorTheme?.overrides);

  const effective = useMemo(
    () => getEffectiveTokens(colorTheme, editMode),
    [colorTheme, editMode],
  );
  const modeOverrides = colorTheme?.overrides?.[editMode] ?? {};

  const selectPreset = (id: string) => {
    writeColorTheme({
      preset: id,
      overrides: colorTheme?.overrides,
    });
  };

  const setToken = (key: keyof ThemeTokens, hex: string) => {
    const nextOverrides: ColorThemeConfig['overrides'] = {
      ...colorTheme?.overrides,
      [editMode]: {
        ...colorTheme?.overrides?.[editMode],
        [key]: hex,
      },
    };
    writeColorTheme({
      preset: presetId,
      overrides: nextOverrides,
    });
  };

  const resetToken = (key: keyof ThemeTokens) => {
    const current = { ...colorTheme?.overrides?.[editMode] };
    delete current[key];
    const nextMode =
      Object.keys(current).length > 0 ? current : undefined;
    const nextOverrides: ColorThemeConfig['overrides'] = {
      ...colorTheme?.overrides,
      [editMode]: nextMode,
    };
    if (!nextOverrides.light && !nextOverrides.dark) {
      writeColorTheme({ preset: presetId });
      return;
    }
    // clean empty mode keys
    if (!nextOverrides.light) delete nextOverrides.light;
    if (!nextOverrides.dark) delete nextOverrides.dark;
    writeColorTheme({
      preset: presetId,
      overrides: hasColorOverrides(nextOverrides) ? nextOverrides : undefined,
    });
  };

  const resetAllOverrides = () => {
    writeColorTheme({ preset: presetId });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">
          <Trans>Color theme</Trans>
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          <Trans>
            Choose a preset. Each preset includes light and dark variants that
            follow the app mode. Customize individual colors below.
          </Trans>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {colorThemePresets.map((preset) => (
          <PresetCard
            key={preset.id}
            name={preset.name}
            selected={presetId === preset.id}
            modified={presetId === preset.id && modified}
            light={preset.light}
            dark={preset.dark}
            onSelect={() => selectPreset(preset.id)}
          />
        ))}
      </div>

      <div className="rounded-md border">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent/40"
          onClick={() => setCustomOpen((o) => !o)}
        >
          <span>
            <Trans>Customize colors</Trans>
            {modified ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                <Trans>overrides active</Trans>
              </span>
            ) : null}
          </span>
          {customOpen ? (
            <ChevronUpIcon className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          )}
        </button>

        {customOpen ? (
          <div className="space-y-3 border-t px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-md border p-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={editMode === 'light' ? 'secondary' : 'ghost'}
                  className="h-7 gap-1 px-2"
                  onClick={() => setEditMode('light')}
                >
                  <SunIcon className="size-3.5" />
                  <Trans>Light</Trans>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={editMode === 'dark' ? 'secondary' : 'ghost'}
                  className="h-7 gap-1 px-2"
                  onClick={() => setEditMode('dark')}
                >
                  <MoonIcon className="size-3.5" />
                  <Trans>Dark</Trans>
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7"
                disabled={!hasColorOverrides(colorTheme?.overrides, editMode)}
                onClick={() => {
                  const next: ColorThemeConfig['overrides'] = {
                    ...colorTheme?.overrides,
                  };
                  delete next?.[editMode];
                  writeColorTheme({
                    preset: presetId,
                    overrides: hasColorOverrides(next) ? next : undefined,
                  });
                }}
              >
                <RotateCcwIcon className="size-3.5" />
                <Trans>Reset this mode</Trans>
              </Button>
            </div>

            <div className="space-y-4">
              {TOKEN_GROUPS.map((group) => (
                <div key={group.title.id} className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    {t(group.title)}
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {group.tokens.map(({ key, label }) => (
                      <ColorRow
                        key={key}
                        label={t(label)}
                        value={effective[key]}
                        overridden={key in modeOverrides}
                        onChange={(hex) => setToken(key, hex)}
                        onReset={() => resetToken(key)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-muted-foreground"
                disabled={!modified}
                onClick={resetAllOverrides}
              >
                <Trans>Reset all overrides</Trans>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
