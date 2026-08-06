import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import {
  Code2,
  DatabaseIcon,
  FolderHeart,
  HelpCircleIcon,
  HistoryIcon,
  LayoutPanelLeftIcon,
  LucideIcon,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';
import { atom } from 'jotai';
import { useAtom } from 'jotai/react';
import { useState } from 'react';

import ToggleColorMode from '@/components/ToggleColorMode';
import { Button } from '@/components/custom/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/custom/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import AppSettingDialog from '@/pages/settings/AppSetting';
import {
  resolveActiveSlots,
  resolvePanelSide,
  resolveSidebarLayout,
  resetPanelSides,
  setPanelSide,
  setSidebarSide,
  type DockSide,
  type SidePanelId,
  useSettingStore,
} from '@/stores/setting';

export const activePanelsAtom = atom<Record<DockSide, string | null>>({
  left: 'database',
  right: null,
});

interface SideButtonProps {
  id: string;
  icon: LucideIcon;
  label: string;
  panel?: SidePanelId;
  tooltipSide?: 'right' | 'left';
  onClick?: () => void;
}

function PanelMenu({
  id,
  label,
  onClose,
}: {
  id: SidePanelId;
  label: string;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const sidebar = useSettingStore((s) => s.sidebar);
  const layout = resolveSidebarLayout(sidebar);
  const overridden = layout.panelSides?.[id] ?? null;
  const value = overridden ?? 'follow';

  return (
    <ContextMenuContent side="right" sideOffset={5} align="start">
      <ContextMenuRadioGroup
        value={value}
        onValueChange={(v) => {
          setPanelSide(id, v === 'follow' ? null : (v as DockSide));
          onClose();
        }}
      >
        <ContextMenuLabel>{label}</ContextMenuLabel>
        <ContextMenuRadioItem value="follow">
          {t`Follow sidebar`}
        </ContextMenuRadioItem>
        <ContextMenuRadioItem value="left">{t`Left`}</ContextMenuRadioItem>
        <ContextMenuRadioItem value="right">{t`Right`}</ContextMenuRadioItem>
      </ContextMenuRadioGroup>
    </ContextMenuContent>
  );
}

const SideButton = ({
  id,
  icon: Comp,
  label,
  panel,
  tooltipSide = 'right',
  onClick,
}: SideButtonProps) => {
  const [activePanels, setActivePanels] = useAtom(activePanelsAtom);
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebar = useSettingStore((s) => s.sidebar);
  const layout = resolveSidebarLayout(sidebar);

  const done = resolveActiveSlots(activePanels, layout);
  const active = panel != null && (done.left === id || done.right === id);

  const handleClick = () => {
    if (panel == null) return;
    setActivePanels((prev) => {
      const open = prev.left === id || prev.right === id;
      const next: Record<DockSide, string | null> = { left: null, right: null };
      for (const p of [prev.left, prev.right]) {
        if (p == null || p === id) continue;
        const s = resolvePanelSide(layout.panelSides, p as SidePanelId, layout.side);
        if (next[s] == null) next[s] = p;
      }
      if (!open) {
        const s = resolvePanelSide(layout.panelSides, panel, layout.side);
        next[s] = id;
      }
      return next;
    });
  };

  const button = (
    <Button
      variant="ghost"
      size="icon"
      className={cn('size-8 rounded-lg', active ? 'bg-muted' : '')}
      aria-label={label}
      onClick={onClick ?? handleClick}
    >
      <Comp className="size-4" />
    </Button>
  );

  if (panel == null) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={button}></TooltipTrigger>
          <TooltipContent side={tooltipSide} sideOffset={5}>
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <ContextMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <Tooltip>
          <ContextMenuTrigger
            onContextMenu={(e) => e.stopPropagation()}
            render={
              <TooltipTrigger render={button}></TooltipTrigger>
            }
          />
          <TooltipContent side={tooltipSide} sideOffset={5}>
            {label}
          </TooltipContent>
        </Tooltip>
        <PanelMenu
          id={panel}
          label={label}
          onClose={() => setMenuOpen(false)}
        />
      </ContextMenu>
    </TooltipProvider>
  );
};

const SIDE_ITEMS = [
  { id: 'database', label: msg`Database`, icon: DatabaseIcon },
  { id: 'favorite', label: msg`Favorite`, icon: FolderHeart },
  { id: 'code', label: msg`Code`, icon: Code2 },
  { id: 'history', label: msg`History`, icon: HistoryIcon },
  { id: 'tabs', label: msg`Tabs`, icon: LayoutPanelLeftIcon },
] as const;

export function ASide() {
  const { t } = useLingui();
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebar = useSettingStore((s) => s.sidebar);
  const layout = resolveSidebarLayout(sidebar);
  const tooltipSide = layout.side === 'left' ? 'right' : 'left';
  const close = () => setMenuOpen(false);

  return (
    <ContextMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <ContextMenuTrigger
        render={
          <aside
            className={cn(
              'inset-y absolute z-20 flex h-full flex-col w-9',
              layout.side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
            )}
          >
            <nav className="grid gap-0.5 p-0.5 [&>*]:place-self-center">
              {SIDE_ITEMS.map((item) => (
                <SideButton
                  key={item.id}
                  id={item.id}
                  label={t(item.label)}
                  icon={item.icon}
                  panel={item.id}
                  tooltipSide={tooltipSide}
                />
              ))}
            </nav>
            <nav className="mt-auto grid gap-1 p-0 [&>*]:place-self-center">
              <SideButton
                id="help"
                label={t`Help`}
                icon={HelpCircleIcon}
                tooltipSide={tooltipSide}
                onClick={() => {
                  open('https://github.com/l1xnan/duckling');
                }}
              />
              <ToggleColorMode />
              <AppSettingDialog />
            </nav>
          </aside>
        }
      />
      <ContextMenuContent side="bottom" sideOffset={4} align="start">
        <ContextMenuRadioGroup
          value={layout.side}
          onValueChange={(v) => {
            setSidebarSide(v as DockSide);
            close();
          }}
        >
          <ContextMenuLabel>{t`Sidebar position`}</ContextMenuLabel>
          <ContextMenuRadioItem value="left">{t`Left`}</ContextMenuRadioItem>
          <ContextMenuRadioItem value="right">
            {t`Right`}
          </ContextMenuRadioItem>
        </ContextMenuRadioGroup>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => {
            resetPanelSides();
            close();
          }}
        >
          {t`Reset panel positions`}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
