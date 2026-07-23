import { Trans, useLingui } from '@lingui/react/macro';
import type { MessageDescriptor } from '@lingui/core';
import {
  BellIcon,
  CheckCircle2Icon,
  InfoIcon,
  TriangleAlertIcon,
  XCircleIcon,
  XIcon,
} from 'lucide-react';

import { Button } from '@/components/custom/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { buildStatusBarLeft } from '@/lib/statusBarContext';
import { cn } from '@/lib/utils';
import { getStoredDB } from '@/stores/dbList';
import {
  AppNotification,
  AppNotificationType,
  NotificationText,
  useNotificationStore,
} from '@/stores/notification';
import { useTabsStore } from '@/stores/tabs';

function typeIcon(type: AppNotificationType) {
  switch (type) {
    case 'success':
      return <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />;
    case 'warning':
      return <TriangleAlertIcon className="size-4 text-amber-600 dark:text-amber-400" />;
    case 'error':
      return <XCircleIcon className="size-4 text-destructive" />;
    default:
      return <InfoIcon className="size-4 text-sky-600 dark:text-sky-400" />;
  }
}

function isMessageDescriptor(value: NotificationText): value is MessageDescriptor {
  return typeof value === 'object' && value !== null && 'id' in value;
}

function NotificationItem({
  item,
  onRead,
  onRemove,
}: {
  item: AppNotification;
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t, i18n } = useLingui();

  const title = isMessageDescriptor(item.title) ? t(item.title) : item.title;
  const description = item.description
    ? isMessageDescriptor(item.description)
      ? t(item.description)
      : item.description
    : undefined;

  let timeLabel: string;
  try {
    timeLabel = new Intl.DateTimeFormat(i18n.locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(item.createdAt));
  } catch {
    timeLabel = new Date(item.createdAt).toLocaleTimeString();
  }

  return (
    <div
      className={cn(
        'group relative flex gap-2 rounded-md border px-2.5 py-2',
        item.read ? 'bg-transparent' : 'bg-muted/40',
      )}
      onMouseEnter={() => {
        if (!item.read) onRead(item.id);
      }}
    >
      <div className="mt-0.5 shrink-0">{typeIcon(item.type)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium">{title}</p>
          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
            {timeLabel}
          </span>
        </div>
        {description ? (
          <p className="mt-0.5 break-all text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(item.id);
        }}
      >
        <XIcon className="size-3" />
      </Button>
    </div>
  );
}

export function StatusBar() {
  const { t } = useLingui();
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const remove = useNotificationStore((s) => s.remove);
  const clear = useNotificationStore((s) => s.clear);
  const currentId = useTabsStore((s) => s.currentId);
  const tabs = useTabsStore((s) => s.tabs);
  const currentTab = currentId ? tabs[currentId] : undefined;
  const connection = currentTab?.dbId
    ? getStoredDB(currentTab.dbId)
    : undefined;
  const left = buildStatusBarLeft(currentTab, connection);
  const leftLabel = left.segments.join(' · ');

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <footer className="w-full h-6 min-h-6 border-t bg-muted/30 flex flex-row justify-between items-center px-2 text-xs tabular-nums text-muted-foreground">
      <div className="flex min-w-0 flex-1 items-center truncate">
        {leftLabel ? (
          <span className="truncate" title={left.title || leftLabel}>
            {leftLabel}
          </span>
        ) : (
          <span>
            <Trans>Ready</Trans>
          </span>
        )}
      </div>
      <Popover
        onOpenChange={(open) => {
          if (open) markAllRead();
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="relative size-5 rounded-sm"
              aria-label={t`Notifications`}
            >
              <BellIcon className="size-3.5" />
              {unread > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[9px] leading-none text-destructive-foreground">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </Button>
          }
        />
        <PopoverContent side="top" align="end" sideOffset={6} className="w-80 gap-2 p-2">
          <PopoverHeader className="flex flex-row items-center justify-between gap-2 px-1 pt-1">
            <PopoverTitle>
              <Trans>Notifications</Trans>
            </PopoverTitle>
            {notifications.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 px-1.5 text-xs text-muted-foreground"
                onClick={() => clear()}
              >
                <Trans>Clear all</Trans>
              </Button>
            ) : null}
          </PopoverHeader>
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
            {notifications.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                <Trans>No notifications yet</Trans>
              </p>
            ) : (
              notifications.map((item) => (
                <NotificationItem
                  key={item.id}
                  item={item}
                  onRead={markRead}
                  onRemove={remove}
                />
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </footer>
  );
}
