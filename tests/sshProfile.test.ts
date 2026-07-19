import { describe, expect, it } from 'vitest';

import {
  flattenSshTunnelForBackend,
  resolveSshTunnelInline,
} from '@/lib/connectionConfig';
import type { DialectConfig } from '@/stores/dbList';
import { useSshProfileStore } from '@/stores/sshProfileList';

describe('SSH profile resolve', () => {
  it('resolveSshTunnelInline fills host from profile', () => {
    const tunnel = resolveSshTunnelInline(
      { enabled: true, profile_id: 'p1' },
      {
        id: 'p1',
        displayName: 'Bastion',
        host: 'bastion.example.com',
        port: '22',
        username: 'deploy',
        host_key_policy: 'accept_new',
      },
    );
    expect(tunnel?.host).toBe('bastion.example.com');
    expect(tunnel?.username).toBe('deploy');
    expect(tunnel?.host_key_policy).toBe('accept_new');
    expect(tunnel?.profile_id).toBe('p1');
  });

  it('flattenSshTunnelForBackend resolves profile_id from store', () => {
    const id = useSshProfileStore.getState().append({
      displayName: 'Test bastion',
      host: '10.0.0.9',
      port: '2222',
      username: 'ops',
      host_key_policy: 'strict',
    });

    const config = {
      dialect: 'mysql',
      host: 'db.internal',
      port: '3306',
      username: 'root',
      password: '',
      database: 'app',
      ssh_tunnel: {
        enabled: true,
        profile_id: id,
      },
    } satisfies DialectConfig;

    const flat = flattenSshTunnelForBackend(config);
    expect(flat.ssh_enabled).toBe(true);
    expect(flat.ssh_host).toBe('10.0.0.9');
    expect(flat.ssh_port).toBe('2222');
    expect(flat.ssh_username).toBe('ops');
    expect(flat.ssh_host_key_policy).toBe('strict');
  });

  it('toRegisterRequest is async and flattens profile ssh', async () => {
    const { toRegisterRequest } = await import('@/lib/connectionRef');
    const id = useSshProfileStore.getState().append({
      displayName: 'Reg bastion',
      host: 'ssh.example',
      port: '22',
      username: 'git',
    });

    const req = await toRegisterRequest('c1', {
      dialect: 'postgres',
      host: 'pg',
      port: '5432',
      username: 'u',
      password: 'db-pw',
      database: 'd',
      ssh_tunnel: { enabled: true, profile_id: id },
    });

    expect(req.payload.ssh_host).toBe('ssh.example');
    expect(req.payload.ssh_username).toBe('git');
    expect(req.payload.password).toBeUndefined();
    expect(req.secrets.password).toBe('db-pw');
  });
});
