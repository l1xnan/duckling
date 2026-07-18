import { invoke } from '@tauri-apps/api/core';

import {
  pickSecrets,
  stripSecrets,
  type ConnectionSecrets,
} from '@/lib/connectionConfig';
import type { DialectConfig } from '@/stores/dbList';

/** IPC dialect handle: prefer connectionId; ad-hoc configs still send full payload. */
export type DialectRef =
  | { connectionId: string; dialect?: string; database?: string }
  | (DialectConfig & { connectionId?: string });

export function connectionRef(
  connectionId: string,
  overrides?: { database?: string; dialect?: string },
): DialectRef {
  return {
    connectionId,
    ...overrides,
  };
}

/** Convert frontend DialectConfig (+ optional id/secrets) into backend register payload. */
export function toRegisterRequest(
  id: string,
  config: DialectConfig | undefined,
  secrets?: ConnectionSecrets,
) {
  const stripped = config ? stripSecrets(config) : ({ dialect: 'duckdb' } as DialectConfig);
  const fromConfig = pickSecrets(config);
  const mergedSecrets: ConnectionSecrets = {
    password: secrets?.password ?? fromConfig.password,
    ssh_password: secrets?.ssh_password ?? fromConfig.ssh_password,
    ssh_passphrase: secrets?.ssh_passphrase ?? fromConfig.ssh_passphrase,
    token: secrets?.token ?? fromConfig.token,
  };

  // Backend DialectPayload uses camelCase via serde rename_all.
  const payload: Record<string, unknown> = {
    ...stripped,
    connectionId: id,
  };

  return {
    id,
    payload,
    secrets: mergedSecrets,
  };
}

export async function registerConnectionBackend(
  id: string,
  config: DialectConfig | undefined,
  secrets?: ConnectionSecrets,
): Promise<void> {
  await invoke('register_connection', {
    request: toRegisterRequest(id, config, secrets),
  });
}

export async function unregisterConnectionBackend(
  connectionId: string,
  deleteSecrets = false,
): Promise<void> {
  await invoke('unregister_connection', {
    connectionId,
    deleteSecrets,
  });
}

export async function syncConnectionsBackend(
  items: Array<{
    id: string;
    config?: DialectConfig;
    secrets?: ConnectionSecrets;
  }>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  await invoke('sync_connections', {
    connections: items.map((item) =>
      toRegisterRequest(item.id, item.config, item.secrets),
    ),
  });
}
