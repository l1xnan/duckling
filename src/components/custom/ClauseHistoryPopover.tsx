import { Trans, useLingui } from '@lingui/react/macro';
import { LucideIcon, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/custom/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function ClauseHistoryPopover({
  icon: Icon,
  terms,
  emptyLabel,
  recentLabel,
  ariaLabel,
  onSelect,
  onRemove,
  onClear,
  triggerClassName,
  contentAlign = 'start',
}: {
  icon: LucideIcon;
  terms: string[];
  emptyLabel: string;
  recentLabel: string;
  ariaLabel: string;
  onSelect: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
  triggerClassName?: string;
  contentAlign?: 'start' | 'center' | 'end';
}) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          triggerClassName,
        )}
        aria-label={ariaLabel}
      >
        <Icon className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        align={contentAlign}
        className="w-72 max-w-[calc(100vw-2rem)] p-1"
      >
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-muted-foreground">{recentLabel}</span>
          {terms.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-1 text-xs text-muted-foreground"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              <Trans>Clear</Trans>
            </Button>
          ) : null}
        </div>
        {terms.length === 0 ? (
          <p className="px-2 py-2 text-center text-xs text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          <div className="flex flex-col">
            {terms.map((term) => (
              <div
                key={term}
                title={term}
                role="button"
                tabIndex={0}
                className={cn(
                  'group flex h-6 min-w-0 cursor-pointer items-center justify-between pr-1 pl-2',
                  'hover:bg-accent',
                )}
                onClick={() => {
                  onSelect(term);
                  setOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(term);
                    setOpen(false);
                  }
                }}
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs">
                  {term}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t`Remove`}
                  className={cn(
                    'ml-1 size-5 shrink-0 hover:bg-selection',
                    'hidden group-hover:block',
                  )}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onRemove(term);
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
