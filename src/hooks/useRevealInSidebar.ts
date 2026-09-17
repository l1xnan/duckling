import { useSetAtom } from 'jotai';
import { useCallback } from 'react';

import { activePanelsAtom } from '@/pages/sidebar/aside';
import { useRevealRequestStore } from '@/stores/reveal';
import { getSidebarLayout, resolvePanelSide } from '@/stores/setting';
import type { TabContextType } from '@/stores/tabs';

/**
 * Switch the sidebar to the database explorer and request a reveal of the
 * given tab. The explorer itself performs the expand/select/scroll sequence.
 */
export function useRevealInSidebar() {
  const setActivePanels = useSetAtom(activePanelsAtom);
  const requestReveal = useRevealRequestStore((s) => s.requestReveal);
  return useCallback(
    (tab: TabContextType) => {
      const layout = getSidebarLayout();
      const side = resolvePanelSide(layout.panelSides, 'database', layout.side);
      setActivePanels((prev) => ({ ...prev, [side]: 'database' }));
      requestReveal(tab);
    },
    [requestReveal, setActivePanels],
  );
}
