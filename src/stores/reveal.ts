import { create } from 'zustand';

import { getQueryChild } from '@/stores/querySession';
import type { TabContextType } from '@/stores/tabs';

export type RevealDbRequest = {
  tab: TabContextType;
  nonce: number;
};

type RevealState = {
  request: RevealDbRequest | null;
  requestReveal: (tab: TabContextType) => void;
  consumeRequest: (nonce: number) => void;
};

let nonce = 0;

export const useRevealRequestStore = create<RevealState>()((set) => ({
  request: null,
  requestReveal: (tab) => set({ request: { tab, nonce: ++nonce } }),
  consumeRequest: (n) =>
    set((s) => (s.request?.nonce === n ? { request: null } : {})),
}));

/**
 * The tab the user perceives as current. Result sub-tabs live in the query
 * session store (keyed by editor id) rather than the main tab store, so an
 * editor with an active result resolves to that `query` child — which has
 * no sidebar counterpart and disables the locate affordance.
 */
export function getEffectiveTab(
  tab: TabContextType | undefined,
  activeResultKey?: string | null,
): TabContextType | undefined {
  if (tab?.type === 'editor' && activeResultKey) {
    return getQueryChild(tab.id, activeResultKey) ?? tab;
  }
  return tab;
}
