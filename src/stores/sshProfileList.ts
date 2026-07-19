import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';

import type { ConnectionSecrets } from '@/lib/connectionConfig';
import { secretsAreEmpty } from '@/lib/connectionConfig';
import {
  deleteConnectionSecrets,
  getConnectionSecrets,
  setConnectionSecrets,
} from '@/stores/secretStore';
import { sshProfilesFileStorage } from '@/stores/tauriStore';

/** Non-secret SSH bastion profile (reusable across DB connections). */
export type SshProfile = {
  id: string;
  displayName: string;
  host: string;
  port?: string;
  username: string;
  private_key_path?: string;
  config_host?: string;
  host_key_policy?: 'insecure' | 'accept_new' | 'strict';
};

export type SshProfileSecrets = {
  ssh_password?: string;
  ssh_passphrase?: string;
};

export function sshProfileSecretId(profileId: string): string {
  return `ssh-profile:${profileId}`;
}

export async function getSshProfileSecrets(
  profileId: string,
): Promise<SshProfileSecrets> {
  const secrets = await getConnectionSecrets(sshProfileSecretId(profileId));
  return {
    ssh_password: secrets?.ssh_password,
    ssh_passphrase: secrets?.ssh_passphrase,
  };
}

export async function setSshProfileSecrets(
  profileId: string,
  secrets: SshProfileSecrets,
): Promise<void> {
  const payload: ConnectionSecrets = {
    ssh_password: secrets.ssh_password,
    ssh_passphrase: secrets.ssh_passphrase,
  };
  if (secretsAreEmpty(payload)) {
    await deleteConnectionSecrets(sshProfileSecretId(profileId));
    return;
  }
  await setConnectionSecrets(sshProfileSecretId(profileId), payload);
}

export async function deleteSshProfileSecrets(profileId: string): Promise<void> {
  await deleteConnectionSecrets(sshProfileSecretId(profileId));
}

type SshProfileListState = {
  profiles: SshProfile[];
};

type SshProfileListAction = {
  append: (profile: Omit<SshProfile, 'id'> & { id?: string }) => string;
  update: (id: string, patch: Partial<SshProfile>) => void;
  remove: (id: string) => Promise<void>;
  getById: (id: string) => SshProfile | undefined;
};

export type SshProfileListStore = SshProfileListState & SshProfileListAction;

export const useSshProfileStore = create<SshProfileListStore>()(
  persist(
    (set, get) => ({
      profiles: [],

      append: (profile) => {
        const id = profile.id?.trim() || nanoid();
        const next: SshProfile = {
          id,
          displayName: profile.displayName.trim() || profile.host || id,
          host: profile.host.trim(),
          port: profile.port?.trim() || '22',
          username: profile.username.trim(),
          private_key_path: profile.private_key_path?.trim() || undefined,
          config_host: profile.config_host?.trim() || undefined,
          host_key_policy: profile.host_key_policy ?? 'insecure',
        };
        set((s) => ({
          profiles: [...s.profiles.filter((p) => p.id !== id), next],
        }));
        return id;
      },

      update: (id, patch) => {
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...patch,
                  id,
                  displayName:
                    patch.displayName?.trim() ||
                    p.displayName ||
                    patch.host?.trim() ||
                    p.host,
                  host: patch.host?.trim() ?? p.host,
                  username: patch.username?.trim() ?? p.username,
                  port: patch.port?.trim() || p.port || '22',
                }
              : p,
          ),
        }));
      },

      remove: async (id) => {
        set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }));
        await deleteSshProfileSecrets(id);
      },

      getById: (id) => get().profiles.find((p) => p.id === id),
    }),
    {
      name: 'sshProfiles',
      storage: createJSONStorage(() => sshProfilesFileStorage),
      partialize: (s) => ({ profiles: s.profiles }),
    },
  ),
);

export function getSshProfile(id: string | undefined | null): SshProfile | undefined {
  if (!id) return undefined;
  return useSshProfileStore.getState().getById(id);
}

export function listSshProfiles(): SshProfile[] {
  return useSshProfileStore.getState().profiles;
}
