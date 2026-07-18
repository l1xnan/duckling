import { invoke } from '@tauri-apps/api/core';

import type { ConnectionSecrets } from '@/lib/connectionConfig';
import { secretsAreEmpty } from '@/lib/connectionConfig';

function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

/** Session cache only — never the sole source of truth across reloads. */
const memorySecrets = new Map<string, ConnectionSecrets>();

export async function getConnectionSecrets(
  connectionId: string,
): Promise<ConnectionSecrets | null> {
  if (!isTauriRuntime()) {
    return memorySecrets.get(connectionId) ?? null;
  }

  try {
    // Always prefer durable storage on read so reload recovers passwords.
    // Tauri 2: JS args are camelCase for snake_case Rust params.
    const secrets = await invoke<ConnectionSecrets | null>('secret_get', {
      connectionId,
    });
    if (secrets && !secretsAreEmpty(secrets)) {
      memorySecrets.set(connectionId, secrets);
      return secrets;
    }
  } catch (error) {
    console.warn('secret_get failed', error);
  }

  return memorySecrets.get(connectionId) ?? null;
}

export async function setConnectionSecrets(
  connectionId: string,
  secrets: ConnectionSecrets,
): Promise<void> {
  if (secretsAreEmpty(secrets)) {
    await deleteConnectionSecrets(connectionId);
    return;
  }

  memorySecrets.set(connectionId, secrets);

  if (!isTauriRuntime()) {
    return;
  }

  // Must succeed for at least one durable backend (keychain and/or vault file).
  await invoke('secret_set', {
    connectionId,
    secrets,
  });
}

export async function deleteConnectionSecrets(
  connectionId: string,
): Promise<void> {
  memorySecrets.delete(connectionId);
  if (!isTauriRuntime()) {
    return;
  }
  try {
    await invoke('secret_delete', { connectionId });
  } catch (error) {
    console.warn('secret_delete failed', error);
  }
}
