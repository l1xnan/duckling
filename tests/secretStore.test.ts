import { beforeEach, describe, expect, it } from 'vitest';

import {
  getInvokeMock,
  lastInvoke,
  onInvoke,
  resetTauriMock,
} from './helpers/mockTauri';
import {
  deleteConnectionSecrets,
  getConnectionSecrets,
  setConnectionSecrets,
} from '@/stores/secretStore';

describe('secretStore', () => {
  beforeEach(() => {
    resetTauriMock();
    // Force Tauri runtime path in Node test env.
    (globalThis as { window?: unknown }).window = {
      __TAURI_INTERNALS__: {},
    };
  });

  it('setConnectionSecrets invokes secret_set with camelCase connectionId', async () => {
    onInvoke('secret_set', () => undefined);

    await setConnectionSecrets('cid-1', { password: 'pw' });

    expect(lastInvoke('secret_set')![1]).toEqual({
      connectionId: 'cid-1',
      secrets: { password: 'pw' },
    });
  });

  it('setConnectionSecrets with empty secrets deletes instead', async () => {
    onInvoke('secret_delete', () => undefined);

    await setConnectionSecrets('cid-2', {});
    expect(lastInvoke('secret_delete')![1]).toEqual({ connectionId: 'cid-2' });
    expect(getInvokeMock().mock.calls.map((c) => c[0])).not.toContain(
      'secret_set',
    );
  });

  it('getConnectionSecrets returns durable store value', async () => {
    onInvoke('secret_get', () => ({ password: 'from-vault' }));

    const secrets = await getConnectionSecrets('cid-3');
    expect(secrets).toEqual({ password: 'from-vault' });
    expect(lastInvoke('secret_get')![1]).toEqual({ connectionId: 'cid-3' });
  });

  it('getConnectionSecrets falls back to session cache on invoke failure', async () => {
    onInvoke('secret_set', () => undefined);
    await setConnectionSecrets('cid-4', { password: 'session' });

    onInvoke('secret_get', () => {
      throw new Error('keychain down');
    });

    const secrets = await getConnectionSecrets('cid-4');
    expect(secrets).toEqual({ password: 'session' });
  });

  it('deleteConnectionSecrets invokes secret_delete', async () => {
    onInvoke('secret_delete', () => undefined);
    await deleteConnectionSecrets('cid-5');
    expect(lastInvoke('secret_delete')![1]).toEqual({ connectionId: 'cid-5' });
  });
});
