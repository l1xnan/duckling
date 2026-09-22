import { useLingui } from '@lingui/react/macro';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/custom/ui/button';
import { cn } from '@/lib/utils';

export type SqlPreviewProps = {
  sql: string;
  className?: string;
};

export function SqlPreview({ sql, className }: SqlPreviewProps) {
  const { t } = useLingui();

  const handleCopy = async () => {
    if (!sql) return;
    try {
      await writeText(sql);
      toast.success(t`SQL copied`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div
      className={cn(
        'relative flex max-h-24 shrink-0 flex-col overflow-hidden rounded-md border bg-muted/40',
        className,
      )}
    >
      <div className="min-h-0 overflow-auto py-2 pr-3 pl-8 font-mono text-xs break-all select-text">
        {sql}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute top-1 left-1"
        onClick={() => {
          void handleCopy();
        }}
        aria-label={t`Copy SQL`}
        title={t`Copy SQL`}
      >
        <CopyIcon className="size-3.5" />
      </Button>
    </div>
  );
}
