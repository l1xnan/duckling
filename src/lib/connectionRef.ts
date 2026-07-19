import { invoke } from '@tauri-apps/api/core';

import {
  flattenSshTunnelForBackend,
  resolveConnectionSecretsForRegister,
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
export async function toRegisterRequest(
  id: string,
  config: DialectConfig | undefined,
  secrets?: ConnectionSecrets,
) {
  const stripped = config
    ? stripSecrets(config)
    : ({ dialect: 'duckdb' } as DialectConfig);
  const mergedSecrets = await resolveConnectionSecretsForRegister(
    config,
    secrets,
  );

  // Backend DialectPayload expects flat `ssh_*` fields (profile resolved here).
  const payload: Record<string, unknown> = {
    ...flattenSshTunnelForBackend(stripped),
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
    request: await toRegisterRequest(id, config, secrets),
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
    connections: await Promise.all(
      items.map((item) => toRegisterRequest(item.id, item.config, item.secrets)),
    ),
  });
}
