import type { MessageDescriptor } from '@lingui/core';
import { nanoid } from 'nanoid';
import { create } from 'zustand';

import { createSelectors } from '@/stores/utils';

export type AppNotificationType = 'success' | 'info' | 'warning' | 'error';

/** Title/description: plain string, or a Lingui `msg` descriptor for locale-reactive UI. */
export type NotificationText = string | MessageDescriptor;

export type AppNotification = {
  id: string;
  type: AppNotificationType;
  title: NotificationText;
  description?: NotificationText;
  createdAt: number;
  read: boolean;
};

type NotificationState = {
  notifications: AppNotification[];
};

type NotificationActions = {
  push: (
    input: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & {
      id?: string;
    },
  ) => string;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
};

const MAX_NOTIFICATIONS = 50;

export const notificationStore = create<NotificationState & NotificationActions>()(
  (set) => ({
    notifications: [],
    push: (input) => {
      const id = input.id ?? nanoid();
      set((state) => ({
        notifications: [
          {
            id,
            type: input.type,
            title: input.title,
            description: input.description,
            createdAt: Date.now(),
            read: false,
          },
          ...state.notifications,
        ].slice(0, MAX_NOTIFICATIONS),
      }));
      return id;
    },
    markRead: (id) =>
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
      })),
    markAllRead: () =>
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.read ? n : { ...n, read: true },
        ),
      })),
    remove: (id) =>
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),
    clear: () => set({ notifications: [] }),
  }),
);

export const useNotificationStore = createSelectors(notificationStore);

export function pushNotification(
  input: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string },
) {
  return notificationStore.getState().push(input);
}
