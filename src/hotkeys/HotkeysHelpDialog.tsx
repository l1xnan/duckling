import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';

import Dialog from '@/components/custom/Dialog';
import { cn } from '@/lib/utils';

import { formatHotkey } from './format';
import {
  HOTKEY_CATEGORY_LABELS,
  HOTKEY_LIST,
  type HotkeyCategory,
  type HotkeyDef,
} from './registry';

const CATEGORY_ORDER: HotkeyCategory[] = [
  'general',
  'editor',
  'tabs',
  'tree',
];

export function HotkeysHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLingui();

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: HOTKEY_LIST.filter((h) => h.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Keyboard shortcuts</Trans>}
      className="min-w-[min(480px,92vw)] max-h-[min(640px,90vh)]"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto py-2 pr-1">
        {byCategory.map(({ cat, items }) => (
          <section key={cat}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(HOTKEY_CATEGORY_LABELS[cat])}
            </h3>
            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <HotkeyRow key={item.id} item={item} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

function HotkeyRow({ item }: { item: HotkeyDef }) {
  const { t } = useLingui();
  const label = formatHotkey(item.hotkey);
  return (
    <li
      className={cn(
        'flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm',
        'hover:bg-muted/50',
      )}
    >
      <span className="min-w-0 truncate">{t(item.label)}</span>
      <kbd
        className={cn(
          'shrink-0 rounded border bg-muted px-1.5 py-0.5',
          'font-mono text-[11px] text-muted-foreground',
        )}
      >
        {label}
      </kbd>
    </li>
  );
}
